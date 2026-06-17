package com.risa.irmis.config;

import com.risa.irmis.entity.Role;
import com.risa.irmis.entity.User;
import com.risa.irmis.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds known local accounts on startup so the app is testable without SSO.
 * The DB is in-memory (H2), so this runs fresh every boot.
 *
 *   admin@risa.gov.rw / Password@123  → ADMIN (can list all users)
 *   user@risa.gov.rw  / Password@123  → USER  (own profile only)
 */
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        seed("admin@risa.gov.rw", "IRMIS Admin", Role.ADMIN);
        seed("user@risa.gov.rw", "IRMIS User", Role.USER);
    }

    private void seed(String email, String fullName, Role role) {
        if (!userRepository.existsByEmail(email)) {
            userRepository.save(User.builder()
                    .email(email)
                    .password(passwordEncoder.encode("Password@123"))
                    .fullName(fullName)
                    .role(role)
                    .build());
        }
    }
}
