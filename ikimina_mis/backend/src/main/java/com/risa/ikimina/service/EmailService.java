package com.risa.ikimina.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String from;

    @Value("${app.verification.code-ttl-minutes}")
    private long ttlMinutes;

    /** Email a login second-factor code. Sent asynchronously so login stays responsive. */
    @Async
    public void sendTwoFactorCode(String to, String code) {
        send(to, "Your Ikimina MIS login code",
                "Your verification code is: " + code + "\n\n" +
                "Enter it to finish signing in. It expires in " + ttlMinutes + " minutes.\n\n" +
                "If you did not try to sign in, you can ignore this email.");
    }

    /** Email a password-reset code. */
    @Async
    public void sendPasswordResetCode(String to, String code) {
        send(to, "Reset your Ikimina MIS password",
                "Your password reset code is: " + code + "\n\n" +
                "Enter it together with your new password. It expires in " + ttlMinutes + " minutes.\n\n" +
                "If you did not request a password reset, you can ignore this email.");
    }

    private void send(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }
}
