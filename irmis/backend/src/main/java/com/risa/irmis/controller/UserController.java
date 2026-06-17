package com.risa.irmis.controller;

import com.risa.irmis.entity.User;
import com.risa.irmis.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(toView(userService.getByEmail(principal.getUsername())));
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
