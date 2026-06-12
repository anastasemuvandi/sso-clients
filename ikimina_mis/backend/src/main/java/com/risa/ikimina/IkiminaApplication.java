package com.risa.ikimina;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class IkiminaApplication {
    public static void main(String[] args) {
        SpringApplication.run(IkiminaApplication.class, args);
    }
}
