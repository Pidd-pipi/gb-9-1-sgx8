import api from './axios'

export const columnApi = {
  list: (params?: { page?: number; size?: number; category?: string }) =>
    api.get('/columns', { params }),

  getById: (id: string) => api.get(`/columns/${id}`),

  getArticles: (columnId: string) => api.get(`/columns/${columnId}/articles`),

  getArticle: (columnId: string, articleId: string) =>
    api.get(`/columns/${columnId}/articles/${articleId}`),

  subscribe: (columnId: string, plan: 'MONTHLY' | 'QUARTERLY' | 'YEARLY') =>
    api.post(`/columns/${columnId}/subscribe`, { plan }),

  mySubscriptions: () => api.get('/my/subscriptions'),

  create: (data: any) => api.post('/columns', data),

  /** 作者新建草稿 */
  createArticle: (
    columnId: string,
    data: { title: string; summary?: string; content?: string; sequence?: number },
  ) => api.post(`/columns/${columnId}/articles`, data),

  /** 预约上线；上线前再次调用即为修改预约时间 */
  scheduleArticle: (columnId: string, articleId: string, scheduledAt: string) =>
    api.post(`/columns/${columnId}/articles/${articleId}/schedule`, { scheduledAt }),

  /** 撤回预约，文章恢复为草稿 */
  unscheduleArticle: (columnId: string, articleId: string) =>
    api.delete(`/columns/${columnId}/articles/${articleId}/schedule`),
}
