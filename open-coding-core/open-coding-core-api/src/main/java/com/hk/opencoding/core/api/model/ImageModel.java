package com.hk.opencoding.core.api.model;

import com.hk.opencoding.core.api.request.ImageRequest;
import com.hk.opencoding.core.api.response.ImageResponse;

/**
 * @author HK意境
 * @version 1.0
 * @since 2026/9/1 21:10
 */
public interface ImageModel extends AiModel {

    ImageResponse generate(ImageRequest request);
}
