
package com.marketflow.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(
            @Value("${marketflow.admin.email}") String adminEmail,
            @Value("${marketflow.admin.password}") String adminPassword,
            PasswordEncoder passwordEncoder) {

        if (adminEmail.isBlank() || adminPassword.isBlank()) {
            throw new IllegalStateException(
                    "Administrator email and password are required"
            );
        }

        return new InMemoryUserDetailsManager(
                User.withUsername(adminEmail)
                        .password(passwordEncoder.encode(adminPassword))
                        .roles("ADMIN")
                        .build()
        );
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http) throws Exception {

        http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/health",
                                "/api/auth/csrf",
                                "/login"
                        ).permitAll()
                        .requestMatchers(
                                "/google-ads/oauth/callback"
                        ).permitAll()
                        .anyRequest().hasRole("ADMIN")
                )
                .csrf(Customizer.withDefaults())
                .formLogin(form -> form
                        .successHandler((request, response, authentication) -> {
                            response.setStatus(200);
                            response.setContentType("application/json");
                            response.getWriter().write(
                                    "{\"authenticated\":true}"
                            );
                        })
                        .failureHandler((request, response, exception) -> {
                            response.sendError(
                                    401,
                                    "Invalid administrator credentials"
                            );
                        })
                        .permitAll()
                )
                .exceptionHandling(errors -> errors
                        .defaultAuthenticationEntryPointFor(
                                (request, response, exception) ->
                                        response.sendError(
                                                401,
                                                "Administrator login required"
                                        ),
                                request -> request.getRequestURI()
                                        .startsWith("/api/")
                        )
                )
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout
                        .logoutSuccessHandler(
                                (request, response, authentication) -> {
                                    response.setStatus(200);
                                    response.setContentType(
                                            "application/json"
                                    );
                                    response.getWriter().write(
                                            "{\"loggedOut\":true}"
                                    );
                                }
                        )
                );

        return http.build();
    }
}
