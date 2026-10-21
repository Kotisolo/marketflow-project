
package com.marketflow.backend;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoogleAdsTokenStorageService {

    private final JdbcTemplate jdbcTemplate;
    private final GoogleAdsTokenEncryptionService encryptionService;

    public GoogleAdsTokenStorageService(
            JdbcTemplate jdbcTemplate,
            GoogleAdsTokenEncryptionService encryptionService) {

        this.jdbcTemplate = jdbcTemplate;
        this.encryptionService = encryptionService;
    }

    @Transactional
    public void saveRefreshToken(
            String adminEmail,
            String refreshToken) {

        if (adminEmail == null || adminEmail.isBlank()) {
            throw new IllegalArgumentException(
                    "Administrator email is required"
            );
        }

        if (refreshToken == null || refreshToken.isBlank()) {
            throw new IllegalArgumentException(
                    "Google refresh token is required"
            );
        }

        String encryptedToken =
                encryptionService.encrypt(refreshToken);

        jdbcTemplate.update(
                """
                INSERT INTO google_ads_connections
                    (admin_email, encrypted_refresh_token,
                     connected_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (admin_email)
                DO UPDATE SET
                    encrypted_refresh_token =
                        EXCLUDED.encrypted_refresh_token,
                    updated_at = CURRENT_TIMESTAMP
                """,
                adminEmail,
                encryptedToken
        );
    }

    @Transactional(readOnly = true)
    public Optional<String> findRefreshToken(String adminEmail) {

        if (adminEmail == null || adminEmail.isBlank()) {
            return Optional.empty();
        }

        return jdbcTemplate.query(
                """
                SELECT encrypted_refresh_token
                FROM google_ads_connections
                WHERE admin_email = ?
                """,
                resultSet -> {
                    if (!resultSet.next()) {
                        return Optional.<String>empty();
                    }

                    String encryptedToken =
                            resultSet.getString(
                                    "encrypted_refresh_token"
                            );

                    return Optional.of(
                            encryptionService.decrypt(encryptedToken)
                    );
                },
                adminEmail
        );
    }

    @Transactional
    public void deleteConnection(String adminEmail) {

        if (adminEmail == null || adminEmail.isBlank()) {
            return;
        }

        jdbcTemplate.update(
                """
                DELETE FROM google_ads_connections
                WHERE admin_email = ?
                """,
                adminEmail
        );
    }
}
