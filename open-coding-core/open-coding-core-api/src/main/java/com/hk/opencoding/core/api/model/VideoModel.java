package com.hk.opencoding.core.api.model;

import com.hk.opencoding.core.api.request.VideoRequest;
import com.hk.opencoding.core.api.response.VideoTask;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/1 21:10
 */
public interface VideoModel extends AiModel {

    VideoTask submit(VideoRequest request);

    VideoTask poll(String taskId);
}
