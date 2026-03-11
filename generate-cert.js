// server/generate-cert.js
const forge = require('node-forge');
const fs = require('fs');

console.log('🔨 Generando llaves (esto puede tardar unos segundos)...');

// 1. Generar par de llaves RSA
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();

// 2. Configurar el certificado
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1); // 1 año

// Datos del sujeto (Tú)
const attrs = [{
  name: 'commonName',
  value: 'SmartBiz Test'
}, {
  name: 'countryName',
  value: 'CO'
}, {
  shortName: 'ST',
  value: 'Bogota'
}, {
  name: 'localityName',
  value: 'Bogota'
}, {
  name: 'organizationName',
  value: 'SmartBiz Inc'
}, {
  shortName: 'OU',
  value: 'Test'
}];

cert.setSubject(attrs);
cert.setIssuer(attrs);

// 3. Firmar el certificado (Auto-firmado)
cert.sign(keys.privateKey, forge.md.sha256.create());

console.log('✅ Certificado creado. Empaquetando en .p12...');

// 4. Empaquetar en PKCS#12 (.p12)
const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
  keys.privateKey,
  [cert],
  '1234', // <--- ESTA ES TU CONTRASEÑA
  {algorithm: '3des'}
);

const p12Der = forge.asn1.toDer(p12Asn1).getBytes();

// 5. Guardar archivo
fs.writeFileSync('certificado-prueba.p12', p12Der, 'binary');

console.log('🎉 ¡LISTO! Se creó el archivo "certificado-prueba.p12"');
console.log('🔑 Contraseña: 1234');