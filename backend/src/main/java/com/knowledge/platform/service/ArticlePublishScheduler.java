package com.knowledge.platform.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 定时将到点的预约文章上线。
 * 预约数据持久化在 MongoDB 中，服务重启后调度自动恢复，
 * 停机期间错过的预约会在启动后的首次执行中补发上线。
 */
@Component
public class ArticlePublishScheduler {
    private static final Logger log = LoggerFactory.getLogger(ArticlePublishScheduler.class);

    @Autowired
    private ArticleService articleService;

    @Scheduled(
            fixedDelayString = "${article.publish-check-interval-ms:30000}",
            initialDelayString = "${article.publish-check-initial-delay-ms:10000}")
    public void publishDueArticles() {
        int publishedCount = articleService.publishDueArticles();
        if (publishedCount > 0) {
            log.info("已上线 {} 篇预约到点的文章", publishedCount);
        }
    }
}
