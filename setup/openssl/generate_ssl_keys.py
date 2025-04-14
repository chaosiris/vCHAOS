import os
from OpenSSL import crypto

def generate_ssl_keys(cert_file="../../src/cert.pem", key_file="../../src/key.pem"):
    """
    Generates a private key (key.pem) and self-signed certificate (cert.pem) in the /src directory.
    Required for app to run on the HTTPS protocol and voice input support.
    """
    cert_exists = os.path.exists(cert_file)
    key_exists = os.path.exists(key_file)

    if cert_exists and key_exists:
        print(f"- SSL keys already exist in {os.path.abspath(os.path.dirname(cert_file))}. Please delete before generating new ones.")
        return

    os.makedirs(os.path.dirname(cert_file), exist_ok=True)

    key = crypto.PKey()
    key.generate_key(crypto.TYPE_RSA, 2048) # Feel free to change the RSA bit length here

    cert = crypto.X509()
    cert.get_subject().CN = "localhost"
    cert.set_serial_number(1000)
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(365 * 24 * 60 * 60)
    cert.set_issuer(cert.get_subject())
    cert.set_pubkey(key)
    cert.sign(key, "sha256")

    with open(key_file, "wb") as key_out:
        key_out.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, key))

    with open(cert_file, "wb") as cert_out:
        cert_out.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))

    print(f"> SSL keys successfully generated and placed in: {os.path.abspath(os.path.dirname(cert_file))}")

generate_ssl_keys()