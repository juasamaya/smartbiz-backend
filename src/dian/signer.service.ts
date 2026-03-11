import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';
import * as fs from 'fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

@Injectable()
export class SignerService {
  
  signXML(xmlString: string, p12Path: string, password: string): string {
    // 1. Cargar el P12 y extraer llaves
    const p12Buffer = fs.readFileSync(p12Path);
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '');

    // Obtener Certificado (con validación de seguridad)
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags?.[forge.pki.oids.certBag]?.[0];
    
    if (!certBag || !certBag.cert) {
        throw new Error('No se encontró un certificado válido en el archivo .p12');
    }
    const cert = certBag.cert;

    // Obtener Llave Privada (con validación de seguridad)
    // Nota: A veces la llave viene en 'pkcs8ShroudedKeyBag' o 'keyBag', probamos el más común primero
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags?.[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

    if (!keyBag || !keyBag.key) {
        throw new Error('No se encontró la llave privada en el archivo .p12');
    }
    const privateKey = keyBag.key as forge.pki.rsa.PrivateKey;

    // Convertir certificado a Base64 (para el XML)
    const certPem = forge.pki.certificateToPem(cert);
    const certBody = certPem.split('\n').filter(line => !line.includes('-----')).join('');

    // 2. Preparar el XML
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    
    // Obtener IDs y Fechas clave (con validación básica)
    const uuidNode = doc.getElementsByTagName('cbc:UUID')[0];
    const issueDateNode = doc.getElementsByTagName('cbc:IssueDate')[0];
    const issueTimeNode = doc.getElementsByTagName('cbc:IssueTime')[0];

    if (!uuidNode || !issueDateNode || !issueTimeNode) {
        throw new Error('El XML no tiene la estructura UBL esperada (Faltan UUID o Fechas)');
    }

    const uuid = uuidNode.textContent;
    const issueDate = issueDateNode.textContent;
    const issueTime = issueTimeNode.textContent;
    // @ts-ignore
    const signingTime = new Date(`${issueDate}T${issueTime.split('-')[0]}`);

    // ID de referencia
    const keyInfoId = `KI-${uuid}`;
    const signatureId = `SIG-${uuid}`;
    const signedPropsId = `SP-${uuid}`;
    const refId = `REF-${uuid}`;

    // 3. Calcular Hash del Documento (DigestValue)
    const md = forge.md.sha256.create();
    md.update(xmlString, 'utf8'); 
    // CORRECCIÓN: Usar forge.util.encode64 + getBytes()
    const documentDigest = forge.util.encode64(md.digest().getBytes());

    // 4. Construir las Propiedades Firmadas (SignedProperties)
    const signedPropertiesXml = `
        <etsi:SignedProperties Id="${signedPropsId}" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#">
            <etsi:SignedSignatureProperties>
                <etsi:SigningTime>${signingTime.toISOString()}</etsi:SigningTime>
                <etsi:SigningCertificate>
                    <etsi:Cert>
                        <etsi:CertDigest>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"/>
                            <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${this.calculateCertDigest(cert)}</ds:DigestValue>
                        </etsi:CertDigest>
                        <etsi:IssuerSerial>
                            <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${this.getIssuerString(cert)}</ds:X509IssuerName>
                            <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${parseInt(cert.serialNumber, 16)}</ds:X509SerialNumber>
                        </etsi:IssuerSerial>
                    </etsi:Cert>
                </etsi:SigningCertificate>
            </etsi:SignedSignatureProperties>
        </etsi:SignedProperties>`.replace(/\s+/g, ' ').trim();

    // Calcular Hash de SignedProperties
    const spMd = forge.md.sha256.create();
    spMd.update(signedPropertiesXml, 'utf8');
    // CORRECCIÓN
    const signedPropsDigest = forge.util.encode64(spMd.digest().getBytes());

    // 5. Construir SignedInfo
    const signedInfoXml = `
    <ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
        <ds:Reference Id="${refId}" URI="">
            <ds:Transforms>
                <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
            </ds:Transforms>
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>${documentDigest}</ds:DigestValue>
        </ds:Reference>
        <ds:Reference URI="#${keyInfoId}">
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>${this.calculateKeyInfoDigest(certBody)}</ds:DigestValue>
        </ds:Reference>
        <ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropsId}">
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>${signedPropsDigest}</ds:DigestValue>
        </ds:Reference>
    </ds:SignedInfo>`.replace(/\s+/g, ' ').trim();

    // 6. FIRMAR EL SIGNED INFO
    const siMd = forge.md.sha256.create();
    siMd.update(signedInfoXml, 'utf8');
    const signatureValue = privateKey.sign(siMd);
    const signatureValueBase64 = forge.util.encode64(signatureValue);

    // 7. Construir el Bloque de Firma Completo
    const signatureBlock = `
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${signatureId}">
        ${signedInfoXml}
        <ds:SignatureValue>${signatureValueBase64}</ds:SignatureValue>
        <ds:KeyInfo Id="${keyInfoId}">
            <ds:X509Data>
                <ds:X509Certificate>${certBody}</ds:X509Certificate>
            </ds:X509Data>
        </ds:KeyInfo>
        <ds:Object>
            <etsi:QualifyingProperties Target="#${signatureId}" xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#">
                ${signedPropertiesXml}
            </etsi:QualifyingProperties>
        </ds:Object>
    </ds:Signature>`;

    // 8. Inyectar en el XML
    const extensionContent = doc.getElementsByTagName('ext:ExtensionContent')[0];
    if (extensionContent) {
        const sigDoc = new DOMParser().parseFromString(signatureBlock, 'text/xml');
        const sigNode = doc.importNode(sigDoc.documentElement, true);
        extensionContent.appendChild(sigNode);
    }

    return new XMLSerializer().serializeToString(doc);
  }

  // --- Utilidades Criptográficas ---

  private calculateCertDigest(cert: any): string {
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha256.create();
    md.update(certDer);
    // CORRECCIÓN
    return forge.util.encode64(md.digest().getBytes());
  }

  private calculateKeyInfoDigest(certBody: string): string {
    const keyInfoContent = `<ds:X509Data xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X509Certificate>${certBody}</ds:X509Certificate></ds:X509Data>`;
    const md = forge.md.sha256.create();
    md.update(keyInfoContent, 'utf8');
    // CORRECCIÓN
    return forge.util.encode64(md.digest().getBytes());
  }

  private getIssuerString(cert: any): string {
    return cert.issuer.attributes.map((attr: any) => `${attr.shortName}=${attr.value}`).reverse().join(', ');
  }
}