# -*- coding: utf-8 -*-
"""토큰 임베딩 + 위치 임베딩 과제 템플릿."""

import torch
import torch.nn as nn


class InputEmbedding(nn.Module):
    """
    token ID를 Transformer 입력 벡터로 바꿉니다.

    구현할 구조:
    - token embedding: nn.Embedding(vocab_size, emb_dim)
    - position embedding: nn.Embedding(context_length, emb_dim)
    - token embedding + position embedding
    - dropout
    """

    def __init__(
        self,
        vocab_size: int,           # 토크나이저가 가지는 전체 단어 개수
        emb_dim: int,              # 각 토큰을 몇 차원 벡터로 표현할지
        context_length: int,       # 한번에 모델이 볼 수 있는 최대 토큰 길이
        drop_rate: float = 0.1,    # 드롭아웃 비율
    ):
        super().__init__()
        self.emb_dim = emb_dim
        self.context_length = context_length
        # TODO: token_embedding, position_embedding, dropout을 정의하세요.
        
        self.token_embedding = nn.Embedding(vocab_size, emb_dim)
        self.position_embedding = nn.Embedding(context_length, emb_dim)

        self.dropout = nn.Dropout(drop_rate)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        TODO: token embedding과 position embedding을 더한 뒤 dropout을 적용합니다.

        Args:
            x: (batch_size, seq_len) token IDs

        Returns:
            (batch_size, seq_len, emb_dim)
        """
        
        token_embeddings = self.token_embedding(x)
        pos = torch.arange(x.shape[-1], device=x.device)
        position_embeddings = self.position_embedding(pos)

        input_embeddings = token_embeddings + position_embeddings
        input_embeddings = self.dropout(input_embeddings)

        return input_embeddings