package com.knowledge.platform.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ArticleScheduleRequest {
    private LocalDateTime scheduledAt;
}
