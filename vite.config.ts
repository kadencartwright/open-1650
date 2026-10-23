import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin, WebSocketClient } from "vite";

const virtualLibraryId = "virtual:open1650-library";
const resolvedVirtualLibraryId = `\0${virtualLibraryId}`;
const syncRegisterEvent = "open1650:sync:register";
const syncSignalEvent = "open1650:sync:signal";
const syncRoomPattern = /^[2-9A-HJ-NP-Z]{6}$/;
const syncPeerPattern = /^[A-Za-z0-9_-]{8,80}$/;

interface LocalSyncRegistration {
  roomCode: string;
  peerId: string;
}

function open1650LocalSyncRelay(): Plugin {
  return {
    name: "open1650-local-sync-relay",
    configureServer(server) {
      const registrations = new Map<WebSocketClient, LocalSyncRegistration>();
      const cleanupInstalled = new WeakSet<WebSocketClient>();

      server.ws.on(syncRegisterEvent, (value, client) => {
        if (!isLocalSyncRegistration(value)) return;
        registrations.set(client, value);
        if (!cleanupInstalled.has(client)) {
          cleanupInstalled.add(client);
          client.socket.once("close", () => registrations.delete(client));
        }
      });

      server.ws.on(syncSignalEvent, (value, client) => {
        if (!isLocalSyncSignal(value)) return;
        const sender = registrations.get(client);
        if (
          !sender ||
          sender.roomCode !== value.roomCode ||
          sender.peerId !== value.from
        ) {
          return;
        }

        // The local adapter is deliberately a dumb, room-scoped relay. It
        // never carries playback commands or timing packets; those are P2P.
        for (const [target, registration] of registrations) {
          if (target !== client && registration.roomCode === sender.roomCode) {
            target.send(syncSignalEvent, value);
          }
        }
      });
    },
  };
}

function isLocalSyncRegistration(value: unknown): value is LocalSyncRegistration {
  if (!isLocalRecord(value)) return false;
  return (
    typeof value.roomCode === "string" &&
    syncRoomPattern.test(value.roomCode) &&
    typeof value.peerId === "string" &&
    syncPeerPattern.test(value.peerId)
  );
}

function isLocalSyncSignal(
  value: unknown,
): value is Record<string, unknown> & { roomCode: string; from: string } {
  if (!isLocalRecord(value)) return false;
  if (
    typeof value.roomCode !== "string" ||
    !syncRoomPattern.test(value.roomCode) ||
    typeof value.from !== "string" ||
    !syncPeerPattern.test(value.from)
  ) {
    return false;
  }
  if (value.version !== 1) return false;
  if (
    typeof value.to !== "string" ||
    (value.to !== "host" && !syncPeerPattern.test(value.to))
  ) {
    return false;
  }
  if (!isLocalRecord(value.signal)) return false;

  if (value.signal.kind === "sdp") {
    const description = value.signal.description;
    return (
      isLocalRecord(description) &&
      (description.type === "offer" || description.type === "answer") &&
      typeof description.sdp === "string" &&
      description.sdp.length > 0 &&
      description.sdp.length <= 1_000_000
    );
  }
  if (value.signal.kind === "ice") {
    const candidate = value.signal.candidate;
    return (
      candidate === null ||
      (isLocalRecord(candidate) &&
        typeof candidate.candidate === "string" &&
        candidate.candidate.length <= 8_192)
    );
  }
  return false;
}

function isLocalRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonDirectory(directory: string) {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".json"))
    .sort();

  return Promise.all(
    files.map(async (file) => ({
      file,
      record: JSON.parse(await readFile(resolve(directory, file), "utf8")),
    })),
  );
}

function open1650LibraryManifest(): Plugin {
  const corpusRoot = resolve(process.cwd(), "corpus");
  const textDirectory = resolve(corpusRoot, "text");
  const tuneDirectory = resolve(corpusRoot, "music/tunes");
  const settingDirectory = resolve(corpusRoot, "music/settings");

  return {
    name: "open1650-library-manifest",
    resolveId(id) {
      return id === virtualLibraryId ? resolvedVirtualLibraryId : undefined;
    },
    async load(id) {
      if (id !== resolvedVirtualLibraryId) return undefined;

      const [psalmFiles, tuneFiles, settingFiles] = await Promise.all([
        readJsonDirectory(textDirectory),
        readJsonDirectory(tuneDirectory),
        readJsonDirectory(settingDirectory),
      ]);
      const manifest = {
        psalms: psalmFiles
          .map(({ file, record }) => ({
            id: record.id,
            psalm_number: record.psalm_number,
            title: record.title,
            version: record.version,
            opening_line: record.opening_line,
            meter: record.meter,
            search_text: [record.title, record.opening_line].join(" "),
            file,
          }))
          .sort(
            (left, right) =>
              left.psalm_number - right.psalm_number ||
              left.version.localeCompare(right.version) ||
              left.id.localeCompare(right.id),
          ),
        tunes: tuneFiles
          .map(({ file, record }) => ({
            id: record.id,
            title: record.title,
            alternate_title: record.alternate_title,
            meter: record.meter,
            file,
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
        settings: settingFiles
          .map(({ file, record }) => ({
            id: record.id,
            psalm_id: record.psalm_id,
            tune_id: record.tune_id,
            file,
          }))
          .sort(
            (left, right) =>
              left.psalm_id.localeCompare(right.psalm_id) ||
              left.tune_id.localeCompare(right.tune_id) ||
              left.id.localeCompare(right.id),
          ),
      };

      return `export default ${JSON.stringify(manifest)};`;
    },
    configureServer(server) {
      server.watcher.add([textDirectory, tuneDirectory, settingDirectory]);
    },
    handleHotUpdate({ file, server }) {
      if (
        file.endsWith(".json") &&
        [textDirectory, tuneDirectory, settingDirectory].some((directory) =>
          file.startsWith(directory),
        )
      ) {
        const module = server.moduleGraph.getModuleById(
          resolvedVirtualLibraryId,
        );
        if (module) {
          server.moduleGraph.invalidateModule(module);
        }
        // A full reload also makes Vite rebuild the lazy glob when a corpus
        // file is added or removed, keeping the manifest and loaders atomic.
        server.ws.send({ type: "full-reload" });
        return [];
      }
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [
    open1650LocalSyncRelay(),
    open1650LibraryManifest(),
    tailwindcss(),
    react(),
  ],
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    css: true,
  },
});
