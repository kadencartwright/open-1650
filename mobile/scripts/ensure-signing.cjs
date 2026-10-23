const {existsSync, writeFileSync, chmodSync} = require('node:fs');
const {resolve} = require('node:path');
const {randomBytes} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const android = resolve(__dirname, '../android');
const properties = resolve(android, 'release-signing.properties');
const keystore = resolve(android, 'app/open1650-release.keystore');
if (!existsSync(properties)) {
  if (existsSync(keystore)) throw new Error('Signing key exists but its properties are missing. Restore the original properties before building an update.');
  const password = randomBytes(32).toString('hex');
  execFileSync('keytool', ['-genkeypair', '-keystore', keystore, '-storepass', password,
    '-keypass', password, '-alias', 'open1650', '-keyalg', 'RSA', '-keysize', '3072',
    '-validity', '10000', '-dname', 'CN=Open 1650 Android, O=Open 1650'], {stdio: 'ignore'});
  chmodSync(keystore, 0o600);
  writeFileSync(properties, `storeFile=open1650-release.keystore\nstorePassword=${password}\nkeyAlias=open1650\nkeyPassword=${password}\n`, {mode: 0o600});
  console.log('Created a private local Android release signing key. Keep the key and properties for future updates.');
} else if (!existsSync(keystore)) {
  throw new Error('Signing properties exist but the key is missing. Restore the original key before building an update.');
}
