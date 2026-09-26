package com.knowledge.platform.scheduler;

import com.knowledge.platform.service.ArticleService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 预约文章自动上线：
 * - 预约信息存在 MongoDB，服务重启后不丢失；
 * - 启动后先补跑一次，把停机期间到点的文章立即上线；
 * - 之后每 10 秒扫描一次，到点自动出现在专栏页。
 */
@Component
public class ArticlePublishScheduler {

    private static final Logger log = LoggerFactory.getLogger(ArticlePublishScheduler.class);

    @Autowired
    private ArticleService articleService;

    @EventListener(ApplicationReadyEvent.class)
    public void publishOverdueOnStartup() {
        try {
            int count = articleService.publishDueArticles();
            log.info("启动补跑预约上线完成，上线文章 {} 篇", count);
        } catch (Exception e) {
            log.error("启动补跑预约上线失败", e);
        }
    }

    @Scheduled(fixedDelayString = "${article.publish.scan-delay-ms:10000}",
            initialDelayString = "${article.publish.scan-delay-ms:10000}")
    public void scan() {
        try {
            articleService.publishDueArticles();
        } catch (Exception e) {
            log.error("扫描预约文章上线失败", e);
        }
    }
}
