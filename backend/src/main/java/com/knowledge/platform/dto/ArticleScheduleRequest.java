package com.knowledge.platform.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ArticleScheduleRequest {
    /**
     * 预约上线时间，必须晚于当前时间；已上线的文章不再接受修改。
     */
    private LocalDateTime scheduledAt;
}
