
package com.marketflow.backend;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    @GetMapping("/api/auth/me")
    public ResponseEntity<?> currentUser(
            Authentication authentication) {

        if (authentication == null
                || !authentication.isAuthenticated()) {
            return ResponseEntity
                    .status(401)
                    .build();
        }

        return ResponseEntity.ok(
                Map.of(
                        "email", authentication.getName(),
                        "authenticated", true
                )
        );
    }

    @GetMapping("/api/auth/csrf")
    public CsrfToken csrfToken(CsrfToken csrfToken) {
        return csrfToken;
    }
}
