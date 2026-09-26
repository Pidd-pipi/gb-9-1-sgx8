package com.knowledge.platform.dto;

import lombok.Data;

@Data
public class ArticleCreateRequest {
    private String title;
    private String summary;
    private String content;
    /** 可选，不传时自动按专栏内文章数顺延 */
    private Integer sequence;
}
