package com.risa.irmis.service;

import com.risa.irmis.dto.AuthResponse;
import com.risa.irmis.dto.LoginRequest;
import com.risa.irmis.dto.RegisterRequest;
import com.risa.irmis.entity.User;
import com.risa.irmis.repository.UserRepository;
import com.risa.irmis.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;

    /** Create a local account. */
    public void register(RegisterRequest request) {
        String email = request.getEmail().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already registered");
        }
        User user = User.builder()
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phoneNumber(request.getPhoneNumber())
                .build();
        userRepository.save(user);
    }

    /** Verify the password and issue a JWT. */
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().toLowerCase();
        // throws BadCredentialsException on a wrong password / unknown email
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.getPassword())
        );
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        String token = jwtTokenProvider.generateToken(userDetails);
        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole().name())
                .build();
    }
}
