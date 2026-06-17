package com.risa.irmis.service;

import com.risa.irmis.entity.User;
import com.risa.irmis.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public User getByEmail(String email) {
        return userRepository.findByEmail(email.toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));
    }

    /** All accounts, newest first — used by the admin user list. */
    public List<User> listAll() {
        return userRepository.findAll();
    }
}
