# -*- coding: utf-8 -*-
"""Multi-Head Self-Attention 과제 템플릿."""

import math
import torch
import torch.nn as nn


class MultiHeadAttention(nn.Module):
    """
    GPT의 causal self-attention을 구현합니다.

    구현할 핵심:
    - Q/K/V projection
    - head 분리: (B, T, C) -> (B, n_heads, T, head_dim)
    - attention score = QK^T / sqrt(head_dim)
    - causal mask로 미래 토큰 가리기
    - attention weight와 V를 곱한 뒤 head를 다시 합치기
    """

    """
        B = batch_size
        T = seq_len, 토큰 개수
        C = d_model, 임베딩 차원

        1. x에서 Q, K, V를 만든다.
        2. Q, K, V를 여러 head로 나눈다.
        3. Q와 K를 내적해서 “누구를 얼마나 볼지” 점수표를 만든다.
        4. GPT이므로 미래 토큰은 못 보게 mask한다.
        5. softmax로 점수를 비율로 바꾼다.
        6. 그 비율대로 V를 섞는다.
        7. head들을 다시 합친다.
        8. output projection으로 한 번 더 섞는다.
    """
    """
        init_ 함수 안의 인자의 의미
        d_model = 토큰 벡터의 차원
        n_heads = attention head의 개수
        qkv_bias = Q/K/V projection에 bias를 쓸 것인가에 대한 여부

        예를 들어 d_model = 768, n_heads = 12 라면
        한 개의 토큰은 768차원이고, 이걸 12개의 head로 나눈다.
    """
    def __init__(
        self,
        d_model: int,
        n_heads: int,
        drop_rate: float = 0.1,
        qkv_bias: bool = False,
    ):
        super().__init__()
        if d_model % n_heads != 0:
            raise ValueError("d_model must be divisible by n_heads")
        self.d_model = d_model
        self.n_heads = n_heads
        self.head_dim = d_model // n_heads
        # TODO: qkv projection, output projection, dropout을 정의하세요.
        self.qkv = nn.Linear(d_model, 3 * d_model, bias=qkv_bias)
        # attention 결과는 head들을 합쳐서 다시 (B, T, C)가 된다.
        # 결과들을 Linear를 통과시킨다.
        self.out_proj = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(drop_rate)

    def forward(
        self,
        x: torch.Tensor,
        causal_mask: bool = True,
        return_attention_weights: bool = False,
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
        """
        TODO: multi-head attention forward를 구현합니다.

        Args:
            x: (batch_size, seq_len, d_model)
            causal_mask: True이면 미래 위치를 볼 수 없게 mask 처리
            return_attention_weights: True이면 attention weight도 함께 반환
        """
        # 입력 x의 shape를 각각 B, T, C에 저장하는 과정
        batch_size, seq_len, d_model = x.shape
        # 입력 x를 qkv layer를 통과시켜서 Q, K, V를 만든다.
        qkv = self.qkv(x)
        # dim = -1 은 마지막 차원으로 나눈다는 뜻
        # qkv: (B, T, 3C) => 마지막 차원으로 쪼개면
        # q : (B, T, C), k : (B, T, C), v : (B, T, C)
        q, k, v = qkv.chunk(3, dim=-1)

        # head 분리하는 과정
        # view 함수 -> input으로 원하는 차원의 형태를 입력하면 변환시켜주는 함수
        # 각 qkv 를 (B, T, C) => (B, T, H, D)로 변환시킨다. (H * D = C)]
        # transpose(1, 2) : 1번 차원과 2번 차원의 위치를 바꾼다.
        # 왜?
        # (B, T, H, D) -> (B, H, T, D)
        # 각 head별로 독립적으로 attention을 계산하기 위해 head 차원을 seq_len 앞쪽으로 이동시킨다.
        q = q.view(batch_size, seq_len, self.n_heads, self.head_dim).transpose(1, 2)
        k = k.view(batch_size, seq_len, self.n_heads, self.head_dim).transpose(1, 2)
        v = v.view(batch_size, seq_len, self.n_heads, self.head_dim).transpose(1, 2)

        # attention score를 구하는 과정
        # q: (B, H, T, D), k.transpose(-2, -1): (B, H, D, T)
        # q와 k를 곱하면 (B, H, T, T)가 된다.
        # 여기서 마지막 (T, T)는 각 토큰이 다른 토큰을 얼마나 볼지에 대한 점수표라고 생각하면 된다.
        scores = q @ k.transpose(-2, -1)

        # q와 k를 내적하면 head_dim이 클수록 값이 커질 수 있다.
        # 값이 너무 커지면 softmax 했을 때 한쪽으로 너무 쏠릴 수 있어서
        # sqrt(head_dim)으로 나눠서 값의 크기를 조절한다.
        scores = scores / math.sqrt(self.head_dim)

        if causal_mask:
            # GPT는 현재 토큰 기준으로 미래 토큰을 보면 안 된다.
            # torch.triu(diagonal=1)은 대각선 위쪽만 True로 만든다.
            # 대각선 위쪽은 현재 위치보다 뒤에 있는 토큰, 즉 미래 토큰에 해당한다.
            mask = torch.triu(
                torch.ones(seq_len, seq_len, device=x.device, dtype=torch.bool),
                diagonal=1,
            )

            # mask가 True인 위치의 score를 -inf로 바꾼다.
            # -inf는 softmax를 지나면 0이 되기 때문에 미래 토큰을 참고 하지 않게 됨
            scores = scores.masked_fill(mask, -torch.inf)

        # score를 softmax에 넣어서 attention weight로 바꾼다.
        # dim=-1은 마지막 차원, 즉 각 토큰이 바라보는 토큰들 방향으로 softmax 한다는 뜻이다.
        # 각 토큰이 참고할 토큰들의 비율 합이 1이 됨
        attention_weights = torch.softmax(scores, dim=-1)

        # attention weight에도 dropout을 적용한다.
        attention_weights = self.dropout(attention_weights)

        # attention weight와 v를 곱해서 실제 token 정보를 섞는다.
        # attention_weights: (B, H, T, T), v: (B, H, T, D) = (B, H, T, D)
        context = attention_weights @ v

        # head별로 나뉘어 있던 결과를 다시 합치는 과정
        # (B, H, T, D) -> transpose를 통해 (B, T, H, D)
        # H * D = C 이므로 view를 통해 다시 (B, T, C)로 바꾼다.
        context = context.transpose(1, 2).contiguous().view(batch_size, seq_len, d_model)

        # 합쳐진 context를 output projection에 통과시킨다.
        # 여러 head에서 나온 정보들을 한 번 더 섞어주는 과정이라고 보면 된다.
        out = self.out_proj(context)
        out = self.dropout(out)

        if return_attention_weights:
            return out, attention_weights

        return out
