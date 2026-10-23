import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator, Alert, AppState, BackHandler, FlatList, Linking,
  Modal, NativeModules, Pressable, Share, StatusBar, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {WebView, type WebViewMessageEvent} from 'react-native-webview';
import catalog from './src/catalog.json';

type Route = {
  view: 'reader' | 'downloads' | 'sources' | 'about';
  psalmNumber: number; version: 'primary' | 'alternate'; edition: 'reading';
  tuneSlug?: string; transpose?: number;
};
type SavedExport = {uri: string; filename: string; mime: string};
const platform = NativeModules.AndroidPlatform as {
  startServer(): Promise<string>; keepAwake(enabled: boolean): void;
  saveFile(filename: string, mime: string, base64: string): Promise<SavedExport>;
  shareFile(filename: string, mime: string): Promise<void>;
};
const DEFAULT: Route = {view: 'reader', psalmNumber: 100, version: 'primary', edition: 'reading'};
const STORAGE_KEY = 'open1650:last-route:v1';

function routePath(route: Route): string {
  if (route.view !== 'reader') return `/${route.view}`;
  const query: string[] = [];
  if (route.tuneSlug) query.push(`tune=${encodeURIComponent(route.tuneSlug)}`);
  if (route.transpose) query.push(`transpose=${route.transpose}`);
  return `/psalms/${String(route.psalmNumber).padStart(3, '0')}/${route.version}${query.length ? `?${query.join('&')}` : ''}`;
}

function PsalterApp() {
  const web = useRef<WebView<object>>(null);
  const [origin, setOrigin] = useState('');
  const [initialPath, setInitialPath] = useState('');
  const [route, setRoute] = useState<Route>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [guest, setGuest] = useState(false);
  const [library, setLibrary] = useState(false);
  const [query, setQuery] = useState('');
  const [exported, setExported] = useState<SavedExport | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([platform.startServer(), AsyncStorage.getItem(STORAGE_KEY)])
      .then(([base, stored]) => {
        let saved = DEFAULT;
        try {
          const parsed = stored ? JSON.parse(stored) : null;
          if (parsed && Number.isInteger(parsed.psalmNumber) && parsed.psalmNumber >= 1 && parsed.psalmNumber <= 150 &&
            ['primary', 'alternate'].includes(parsed.version)) {
            saved = {...DEFAULT, ...parsed, view: 'reader'};
          }
        } catch { /* A corrupt preference should not prevent opening the library. */ }
        if (!active) return;
        setRoute(saved); setInitialPath(routePath(saved)); setOrigin(base);
      }).catch(() => {if (active) setError('The offline library could not be opened. Tap Retry to try again.');});
    return () => {active = false; platform.keepAwake(false);};
  }, [retry]);

  const navigate = useCallback((next: Partial<Route>) => {
    if (guest) {
      Alert.alert('Following the leader', 'Leave the singing group before choosing another Psalm.');
      return;
    }
    web.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('open1650:navigate',{detail:${JSON.stringify(next)}})); true;`);
  }, [guest]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        web.current?.injectJavaScript("window.dispatchEvent(new Event('open1650:background')); true;");
        platform.keepAwake(false);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (library) {setLibrary(false); return true;}
      // Give an expanded player menu or dialog the first opportunity to close.
      if (canGoBack) {web.current?.goBack(); return true;}
      if (route.view !== 'reader') {navigate({view: 'reader'}); return true;}
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack, library, navigate, route.view]);

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    // The bridge is accepted only from the bundled local player.
    if (event.nativeEvent.url !== origin && !event.nativeEvent.url.startsWith(`${origin}/`)) return;
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'route') {
        setRoute(message.route); setGuest(Boolean(message.guest)); setReady(true); setError('');
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(message.route)).catch(() => {});
      } else if (message.type === 'playback') {
        platform.keepAwake(Boolean(message.playing));
      } else if (message.type === 'download' && typeof message.base64 === 'string') {
        setSaving(true);
        try {
          const file = await platform.saveFile(message.filename, message.mime, message.base64);
          setExported(file);
          Alert.alert('Saved to Downloads', `${file.filename}\nDownloads / Open1650`, [
            {text: 'Done'},
            {text: 'Share', onPress: () => platform.shareFile(file.filename, file.mime).catch(() => Alert.alert('Sharing unavailable', 'The file is saved in Downloads / Open1650.'))},
          ]);
        } finally {setSaving(false);}
      } else if (message.type === 'error') {
        Alert.alert('Open 1650', String(message.message));
      }
    } catch (reason) {
      Alert.alert('Something went wrong', reason instanceof Error ? reason.message : 'Please try that action again.');
    }
  }, [origin]);

  const songs = useMemo(() => {
    const search = query.trim().toLowerCase();
    return catalog.filter(song => !search || String(song.number) === search ||
      `${song.number} ${song.opening} ${song.meter} ${song.version} ${song.search}`.toLowerCase().includes(search));
  }, [query]);
  const source = useMemo(() => ({uri: `${origin}${initialPath}`}), [origin, initialPath]);

  return (
    <SafeAreaView style={styles.app} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f0e7" />
      <View style={styles.header}>
        <View style={styles.brandMark}><Text style={styles.brandNumber}>1650</Text></View>
        <View style={styles.brandCopy}>
          <Text style={styles.brand}>Open 1650</Text>
          <Text style={styles.subtitle}>THE SCOTTISH PSALTER · OFFLINE LIBRARY</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Share Open 1650" style={styles.share} onPress={() => {
          Share.share({message: `Sing Psalm ${route.psalmNumber} with Open 1650\nhttps://1650.kdn.dev${routePath({...route, view: 'reader'})}`}).catch(() => {});
        }}><Text style={styles.shareLabel}>Share</Text></Pressable>
      </View>

      <View style={styles.content}>
        {origin && <WebView<object>
          key={retry} ref={web} source={source}
          style={styles.web} onMessage={onMessage}
          javaScriptEnabled domStorageEnabled mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false} allowFileAccess={false}
          mixedContentMode="never" webviewDebuggingEnabled={__DEV__}
          onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
          onShouldStartLoadWithRequest={request => {
            if (request.url.startsWith(`${origin}/`) || request.url === 'about:blank') return true;
            if (/^https?:\/\//.test(request.url)) Linking.openURL(request.url).catch(() => Alert.alert('Link unavailable', 'No browser could open this link.'));
            return false;
          }}
          onError={() => setError('The player could not load. Your library is stored on this device. Tap Retry to reopen it.')}
          onLoadEnd={() => {
            setReady(true);
            web.current?.injectJavaScript("window.dispatchEvent(new Event('open1650:host-ready')); true;");
          }}
          onRenderProcessGone={() => {setReady(false); setRetry(n => n + 1);}}
        />}
        {(!ready || error) && <View style={styles.loading}>
          {error ? <><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} accessibilityRole="button" onPress={() => {setError(''); setReady(false); setRetry(n => n + 1);}}><Text style={styles.retryText}>Retry</Text></Pressable></> : <><ActivityIndicator color="#7f352d" size="large" /><Text style={styles.loadingText}>Opening your Psalter…</Text></>}
        </View>}
      </View>
      {saving && <Text accessibilityLiveRegion="polite" style={styles.notice}>Saving your export…</Text>}
      <View style={styles.tabs}>
        {[
          {label: 'Psalms', symbol: '☷', active: false, action: () => {setQuery(''); setLibrary(true);}},
          {label: 'Sing', symbol: '♫', active: route.view === 'reader', action: () => navigate({view: 'reader'})},
          {label: 'Files', symbol: '↓', active: route.view === 'downloads', action: () => navigate({view: 'downloads'})},
          {label: 'Sources', symbol: '≡', active: route.view === 'sources', action: () => navigate({view: 'sources'})},
          {label: 'About', symbol: 'ⓘ', active: route.view === 'about', action: () => navigate({view: 'about'})},
        ].map(tab => <Pressable key={tab.label} style={styles.tab} accessibilityRole="button" accessibilityLabel={tab.label === 'Psalms' ? 'Choose a Psalm' : tab.label} accessibilityState={{selected: tab.active}} onPress={tab.action}>
          <Text style={[styles.tabIcon, tab.active && styles.selected]}>{tab.symbol}</Text>
          <Text style={[styles.tabLabel, tab.active && styles.selected]}>{tab.label}</Text>
        </Pressable>)}
      </View>
      <Modal visible={library} animationType="slide" onRequestClose={() => setLibrary(false)}>
        <SafeAreaView style={styles.app}>
          <View style={styles.modalHeading}><View><Text style={styles.libraryTitle}>The Psalter</Text><Text style={styles.librarySubtitle}>150 Psalms · 13 alternate versions · All offline</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close Psalm library" onPress={() => setLibrary(false)} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable></View>
          <TextInput style={styles.search} placeholder="Psalm number or words…" placeholderTextColor="#777268" accessibilityLabel="Search Psalms" value={query} onChangeText={setQuery} autoCorrect={false} clearButtonMode="while-editing" />
          <FlatList data={songs} keyExtractor={song => song.id} keyboardShouldPersistTaps="handled" initialNumToRender={15}
            ListEmptyComponent={<Text style={styles.empty}>No Psalms match these words.</Text>}
            renderItem={({item}) => <Pressable accessibilityRole="button" accessibilityLabel={`Psalm ${item.number}${item.version === 'alternate' ? ', alternate version' : ''}: ${item.opening}`} style={[styles.song, item.number === route.psalmNumber && item.version === route.version && styles.activeSong]} onPress={() => {
              setLibrary(false); navigate({view: 'reader', psalmNumber: item.number, version: item.version as Route['version'], tuneSlug: undefined});
            }}><View style={styles.songNumber}><Text style={styles.number}>{String(item.number).padStart(3, '0')}</Text></View><View style={styles.songCopy}><Text style={styles.songTitle}>Psalm {item.number}{item.version === 'alternate' ? ' · Alternate' : ''}</Text><Text numberOfLines={2} style={styles.opening}>{item.opening}</Text><Text style={styles.meter}>{item.meter}</Text></View><Text style={styles.chevron}>›</Text></Pressable>}
          />
          {exported && <Pressable style={styles.lastExport} accessibilityRole="button" onPress={() => platform.shareFile(exported.filename, exported.mime).catch(() => {})}><Text style={styles.shareLabel}>Share last export: {exported.filename}</Text></Pressable>}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {return <SafeAreaProvider><PsalterApp /></SafeAreaProvider>;}

const styles = StyleSheet.create({
  app: {flex: 1, backgroundColor: '#f4f0e7'}, header: {height: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#dcd5c8', gap: 10},
  brandMark: {width: 39, height: 39, borderWidth: 1, borderColor: '#7f352d', alignItems: 'center', justifyContent: 'center', borderRadius: 8}, brandNumber: {color: '#7f352d', fontFamily: 'serif', fontSize: 15, fontWeight: '700'}, brandCopy: {flex: 1}, brand: {fontFamily: 'serif', color: '#26251f', fontSize: 23}, subtitle: {fontSize: 8, color: '#777268', letterSpacing: 0.7, marginTop: 3},
  share: {minHeight: 44, minWidth: 48, justifyContent: 'center', alignItems: 'center'}, shareLabel: {fontSize: 12, color: '#7f352d', fontWeight: '600'}, content: {flex: 1}, web: {flex: 1, backgroundColor: '#fbfaf6'},
  loading: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbfaf6', padding: 28, gap: 16}, loadingText: {fontFamily: 'serif', color: '#777268', fontSize: 20}, error: {textAlign: 'center', color: '#7f352d', fontSize: 16}, retry: {paddingHorizontal: 28, paddingVertical: 12, backgroundColor: '#7f352d', borderRadius: 8}, retryText: {color: 'white', fontWeight: '600'}, notice: {padding: 8, color: '#7f352d', textAlign: 'center'},
  tabs: {height: 62, flexDirection: 'row', borderTopWidth: 1, borderColor: '#dcd5c8', backgroundColor: '#f9f7f1'}, tab: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48}, tabIcon: {fontSize: 23, color: '#777268'}, tabLabel: {fontSize: 10, color: '#777268', fontWeight: '600'}, selected: {color: '#7f352d'},
  modalHeading: {padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}, libraryTitle: {fontFamily: 'serif', fontSize: 34, color: '#26251f'}, librarySubtitle: {fontSize: 11, color: '#777268', marginTop: 5}, close: {width: 44, height: 44, justifyContent: 'center', alignItems: 'center'}, closeText: {fontSize: 22, color: '#7f352d'}, search: {marginHorizontal: 20, marginBottom: 14, borderWidth: 1, borderColor: '#dcd5c8', backgroundColor: '#fbfaf6', borderRadius: 8, paddingHorizontal: 15, minHeight: 48, fontSize: 16, color: '#26251f'},
  song: {flexDirection: 'row', padding: 17, gap: 14, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#dcd5c8'}, activeSong: {backgroundColor: '#eee4d8'}, songNumber: {width: 42}, number: {fontFamily: 'serif', fontSize: 23, color: '#a78856'}, songCopy: {flex: 1}, songTitle: {fontSize: 14, fontWeight: '600', color: '#26251f'}, opening: {fontSize: 13, color: '#5e5a51', marginTop: 4, lineHeight: 19}, meter: {fontSize: 10, color: '#777268', marginTop: 5}, chevron: {fontSize: 25, color: '#a78856'}, empty: {padding: 30, textAlign: 'center', color: '#777268'}, lastExport: {padding: 16, borderTopWidth: 1, borderColor: '#dcd5c8'},
});
