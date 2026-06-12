package com.risa.ikimina.controller;

import com.risa.ikimina.dto.AuthResponse;
import com.risa.ikimina.dto.ChangePasswordRequest;
import com.risa.ikimina.dto.MessageResponse;
import com.risa.ikimina.dto.UpdateProfileRequest;
import com.risa.ikimina.entity.User;
import com.risa.ikimina.security.JwtTokenProvider;
import com.risa.ikimina.security.UserDetailsServiceImpl;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final com.risa.ikimina.service.UserService userService;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsServiceImpl userDetailsService;

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(toView(userService.getByEmail(principal.getUsername())));
    }

    /**
     * Update display fields. Email may change, which invalidates the current JWT
     * (its subject is the old email), so we return a freshly minted token.
     */
    @PutMapping("/profile")
    public ResponseEntity<AuthResponse> updateProfile(@AuthenticationPrincipal UserDetails principal,
                                                      @Valid @RequestBody UpdateProfileRequest request) {
        User updated = userService.updateProfile(principal.getUsername(), request);
        String token = jwtTokenProvider.generateToken(
                userDetailsService.loadUserByUsername(updated.getEmail()));
        return ResponseEntity.ok(AuthResponse.builder()
                .token(token)
                .email(updated.getEmail())
                .fullName(updated.getFullName())
                .build());
    }

    @PutMapping("/password")
    public ResponseEntity<MessageResponse> changePassword(@AuthenticationPrincipal UserDetails principal,
                                                          @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(principal.getUsername(), request);
        return ResponseEntity.ok(new MessageResponse("Password changed successfully."));
    }

    private Map<String, Object> toView(User user) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("email", user.getEmail());
        view.put("fullName", user.getFullName() != null ? user.getFullName() : "");
        view.put("phoneNumber", user.getPhoneNumber() != null ? user.getPhoneNumber() : "");
        view.put("createdAt", user.getCreatedAt().toString());
        return view;
    }
}
