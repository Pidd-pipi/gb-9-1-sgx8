package com.knowledge.platform.controller;

import com.knowledge.platform.dto.ApiResponse;
import com.knowledge.platform.dto.ArticleCreateRequest;
import com.knowledge.platform.dto.ArticleScheduleRequest;
import com.knowledge.platform.dto.ColumnCreateRequest;
import com.knowledge.platform.dto.SubscribeRequest;
import com.knowledge.platform.entity.Article;
import com.knowledge.platform.entity.Column;
import com.knowledge.platform.entity.Subscription;
import com.knowledge.platform.security.CurrentUserUtil;
import com.knowledge.platform.service.ArticleService;
import com.knowledge.platform.service.ColumnService;
import com.knowledge.platform.service.SubscriptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/columns")
public class ColumnController {
    @Autowired
    private ColumnService columnService;

    @Autowired
    private ArticleService articleService;

    @Autowired
    private SubscriptionService subscriptionService;

    @Autowired
    private CurrentUserUtil currentUserUtil;

    @GetMapping
    public ApiResponse<Page<Column>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return columnService.list(pageable);
    }

    @GetMapping("/{id}")
    public ApiResponse<Column> getById(@PathVariable String id) {
        return columnService.getById(id);
    }

    @PostMapping
    public ApiResponse<Column> create(@RequestBody ColumnCreateRequest request) {
        String userId = currentUserUtil.getCurrentUserId();
        if (userId == null) {
            return ApiResponse.error("请先登录");
        }
        return columnService.create(userId, request);
    }

    @GetMapping("/{id}/articles")
    public ApiResponse<List<Article>> getArticles(@PathVariable String id) {
        // 读者只看到已上线文章；当前用户若是专栏作者，则连草稿和预约中的文章一并返回
        String userId = currentUserUtil.getCurrentUserId();
        List<Article> articles = articleService.listForColumn(id, userId);
        return ApiResponse.success(articles);
    }

    @GetMapping("/{columnId}/articles/{articleId}")
    public ApiResponse<Article> getArticle(
            @PathVariable String columnId,
            @PathVariable String articleId) {
        String userId = currentUserUtil.getCurrentUserId();
        return articleService.getForReader(columnId, articleId, userId);
    }

    /** 作者新建草稿（草稿只有作者本人可见） */
    @PostMapping("/{columnId}/articles")
    public ApiResponse<Article> createArticle(
            @PathVariable String columnId,
            @RequestBody ArticleCreateRequest request) {
        String userId = currentUserUtil.getCurrentUserId();
        return articleService.createDraft(userId, columnId, request);
    }

    /** 作者为草稿预约未来上线时间；上线前可再次调用以修改时间 */
    @PostMapping("/{columnId}/articles/{articleId}/schedule")
    public ApiResponse<Article> scheduleArticle(
            @PathVariable String columnId,
            @PathVariable String articleId,
            @RequestBody ArticleScheduleRequest request) {
        String userId = currentUserUtil.getCurrentUserId();
        return articleService.schedule(userId, columnId, articleId, request.getScheduledAt());
    }

    /** 上线前撤回预约，文章恢复为草稿 */
    @DeleteMapping("/{columnId}/articles/{articleId}/schedule")
    public ApiResponse<Article> unscheduleArticle(
            @PathVariable String columnId,
            @PathVariable String articleId) {
        String userId = currentUserUtil.getCurrentUserId();
        return articleService.unschedule(userId, columnId, articleId);
    }

    @PostMapping("/{id}/subscribe")
    public ApiResponse<Subscription> subscribe(
            @PathVariable String id,
            @RequestBody SubscribeRequest request) {
        String userId = currentUserUtil.getCurrentUserId();
        if (userId == null) {
            return ApiResponse.error("请先登录");
        }
        return subscriptionService.subscribe(userId, id, request);
    }
}
