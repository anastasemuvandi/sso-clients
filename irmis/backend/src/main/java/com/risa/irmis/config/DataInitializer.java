package com.risa.irmis.config;

import com.risa.irmis.entity.User;
import com.risa.irmis.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds a single known local account on startup so the app is testable without
 * SSO. The DB is in-memory (H2), so this runs fresh every boot.
 * Login: admin@risa.gov.rw / Password@123
 */
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        String email = "admin@risa.gov.rw";
        if (!userRepository.existsByEmail(email)) {
            userRepository.save(User.builder()
                    .email(email)
                    .password(passwordEncoder.encode("Password@123"))
                    .fullName("IRMIS Admin")
                    .build());
        }
    }
}
