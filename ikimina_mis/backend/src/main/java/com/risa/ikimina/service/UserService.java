package com.risa.ikimina.service;

import com.risa.ikimina.dto.ChangePasswordRequest;
import com.risa.ikimina.dto.UpdateProfileRequest;
import com.risa.ikimina.entity.User;
import com.risa.ikimina.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public User getByEmail(String email) {
        return userRepository.findByEmail(email.toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));
    }

    /** Update display fields. Changing email is allowed as long as it stays unique. */
    public User updateProfile(String currentEmail, UpdateProfileRequest request) {
        User user = getByEmail(currentEmail);
        String newEmail = request.getEmail().toLowerCase();
        if (!newEmail.equals(user.getEmail()) && userRepository.existsByEmail(newEmail)) {
            throw new IllegalArgumentException("Email already in use");
        }
        user.setEmail(newEmail);
        user.setFullName(request.getFullName());
        user.setPhoneNumber(request.getPhoneNumber());
        return userRepository.save(user);
    }

    public void changePassword(String currentEmail, ChangePasswordRequest request) {
        User user = getByEmail(currentEmail);
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }
}
