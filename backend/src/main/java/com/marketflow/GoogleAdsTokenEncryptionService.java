
package com.marketflow.backend;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class GoogleAdsTokenEncryptionService {

    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final SecretKeySpec secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public GoogleAdsTokenEncryptionService(
            @Value("${marketflow.token-encryption-key:${MARKETFLOW_TOKEN_ENCRYPTION_KEY:}}")
            String encodedKey) {

        if (encodedKey == null || encodedKey.isBlank()) {
            throw new IllegalStateException(
                    "MARKETFLOW_TOKEN_ENCRYPTION_KEY is not configured"
            );
        }

        byte[] keyBytes;

        try {
            keyBytes = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(
                    "Token encryption key must be valid Base64",
                    exception
            );
        }

        if (keyBytes.length != 32) {
            throw new IllegalStateException(
                    "Token encryption key must contain 32 bytes"
            );
        }

        this.secretKey = new SecretKeySpec(keyBytes, "AES");
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            throw new IllegalArgumentException(
                    "Token cannot be empty"
            );
        }

        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.ENCRYPT_MODE,
                    secretKey,
                    new GCMParameterSpec(TAG_LENGTH_BITS, iv)
            );

            byte[] ciphertext = cipher.doFinal(
                    plaintext.getBytes(StandardCharsets.UTF_8)
            );

            byte[] combined = new byte[iv.length + ciphertext.length];

            System.arraycopy(
                    iv, 0, combined, 0, iv.length
            );

            System.arraycopy(
                    ciphertext, 0,
                    combined, iv.length, ciphertext.length
            );

            return Base64.getEncoder().encodeToString(combined);

        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Unable to encrypt Google Ads token",
                    exception
            );
        }
    }

    public String decrypt(String encryptedValue) {
        if (encryptedValue == null || encryptedValue.isBlank()) {
            throw new IllegalArgumentException(
                    "Encrypted token cannot be empty"
            );
        }

        try {
            byte[] combined =
                    Base64.getDecoder().decode(encryptedValue);

            if (combined.length <= IV_LENGTH + 16) {
                throw new IllegalArgumentException(
                        "Encrypted token is invalid"
                );
            }

            byte[] iv = new byte[IV_LENGTH];
            byte[] ciphertext =
                    new byte[combined.length - IV_LENGTH];

            System.arraycopy(
                    combined, 0, iv, 0, IV_LENGTH
            );

            System.arraycopy(
                    combined, IV_LENGTH,
                    ciphertext, 0, ciphertext.length
            );

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    secretKey,
                    new GCMParameterSpec(TAG_LENGTH_BITS, iv)
            );

            byte[] plaintext = cipher.doFinal(ciphertext);

            return new String(
                    plaintext,
                    StandardCharsets.UTF_8
            );

        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Unable to decrypt Google Ads token",
                    exception
            );
        }
    }
}
