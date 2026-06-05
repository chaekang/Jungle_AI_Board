# -*- coding: utf-8 -*-
"""
UTF-8 byte-level BPE 토크나이저 과제 템플릿.

외부 tokenizer 라이브러리 없이 BPE(Byte Pair Encoding)를 직접 구현합니다.
한국어 NSMC 리뷰를 다루므로 문자열을 글자/공백 단위로 먼저 자르지 말고,
항상 `text.encode("utf-8")`로 byte ID 시퀀스를 만든 뒤 merge를 적용하세요.
"""

from pathlib import Path
from collections import Counter
import json

PAD_TOKEN = "<pad>"
UNK_TOKEN = "<unk>"
BOS_TOKEN = "<bos>"
EOS_TOKEN = "<eos>"

SPECIAL_TOKENS = [PAD_TOKEN, UNK_TOKEN, BOS_TOKEN, EOS_TOKEN]
SPECIAL_IDS = {token: idx for idx, token in enumerate(SPECIAL_TOKENS)}
BYTE_OFFSET = len(SPECIAL_TOKENS)
NUM_BYTES = 256


class BPETokenizer:
    """
    UTF-8 byte-level BPE 토크나이저.

    권장 ID 배치:
    - 0~3: <pad>, <unk>, <bos>, <eos>
    - 4~259: 원본 byte 0~255
    - 260 이상: BPE merge로 생성한 토큰
    """

    def __init__(self, vocab_size: int = 3000):
        self.vocab_size = vocab_size
        self.id_to_token = {}
        self.token_to_id = {}
        self.merges = []

    def _init_special_tokens(self):
        """
        TODO:
        1. 특수 토큰 4개를 고정 ID 0~3에 등록합니다.
        2. byte 0~255를 ID 4~259에 bytes([byte_value]) 형태로 등록합니다.
        """

        self.id_to_token = {}
        self.token_to_id = {}
        self.merges = []

        for token_id, token in enumerate(SPECIAL_TOKENS):
            self.id_to_token[token_id] = token
            self.token_to_id[token] = token_id
        
        for i in range(BYTE_OFFSET, NUM_BYTES + BYTE_OFFSET):
            self.id_to_token[i] = bytes([i-BYTE_OFFSET])
            self.token_to_id[bytes([i-BYTE_OFFSET])] = i

    def get_pad_id(self):
        """padding 토큰 ID."""
        return SPECIAL_IDS[PAD_TOKEN]

    def get_unk_id(self):
        """unknown 토큰 ID."""
        return SPECIAL_IDS[UNK_TOKEN]

    def get_bos_id(self):
        """문장 시작 토큰 ID."""
        return SPECIAL_IDS[BOS_TOKEN]

    def get_eos_id(self):
        """문장 끝 토큰 ID."""
        return SPECIAL_IDS[EOS_TOKEN]

    def train(self, corpus: str):
        """
        TODO: 코퍼스에서 BPE merge rule과 vocabulary를 학습합니다.

        구현 힌트:
        - `corpus.encode("utf-8")`로 byte ID 시퀀스를 만듭니다.
        - 가장 자주 등장하는 이웃 token pair를 찾습니다.
        - 새 token ID를 만들고, 시퀀스의 해당 pair를 새 ID로 치환합니다.
        - `self.merges`, `self.id_to_token`, `self.token_to_id`를 갱신합니다.
        """
        self._init_special_tokens()

        ids = [b + BYTE_OFFSET for b in corpus.encode("utf-8")]
        next_id = NUM_BYTES + BYTE_OFFSET

        while next_id < self.vocab_size:
            # 페어 개수 세기
            pair_counts = self._count_pairs(ids)
            if not pair_counts:
                break
            
            # 가장 많이 사용된 페어
            best_pair = max(pair_counts, key=pair_counts.get)
            if pair_counts[best_pair] < 2:
                break

            # 가장 많이 사용된 페어 머지, 단어 사전에 추가
            self.merges.append(best_pair)
            self.id_to_token[next_id] = best_pair
            self.token_to_id[best_pair] = next_id

            ids = self._merge(ids, best_pair, next_id)
            next_id += 1

    def save(self, path: str | Path):
        """
        TODO: vocabulary와 merge rule을 JSON 파일로 저장합니다.

        bytes와 tuple은 JSON에 바로 저장할 수 없으므로 type 정보를 함께 저장하세요.
        """
        data = {
            "vocab_size": self.vocab_size,
            "merges": [],
            "id_to_token": {}
        }

        for pair in self.merges:
            data["merges"].append({
                "pair": list(pair)
            })
        
        for key, value in self.id_to_token.items():
            if isinstance(value, bytes):
                data["id_to_token"][str(key)] = {
                    "type": "bytes",
                    "value": list(value)
                }
            elif isinstance(value, str):
                data["id_to_token"][str(key)] = {
                    "type": "special",
                    "value": value
                }
            else:
                data["id_to_token"][str(key)] = {
                    "type": "tuple",
                    "value": value
                }
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self, path: str | Path):
        """
        TODO: save()로 저장한 JSON 파일을 읽어 vocabulary와 merge rule을 복원합니다.
        """
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        self.vocab_size = data["vocab_size"]

        self.merges = []
        for merge in data["merges"]:
            pair = tuple(merge["pair"])
            self.merges.append(pair)
        
        self.id_to_token = {}
        self.token_to_id = {}
        for key, value in data["id_to_token"].items():
            new_id = int(key)
            if value["type"] == "special":
                v = str(value["value"])
                self.id_to_token[new_id] = v
                self.token_to_id[v] = new_id
            elif value["type"] == "bytes":
                v = bytes(value["value"])
                self.id_to_token[new_id] = v
                self.token_to_id[v] = new_id
            else:
                v = tuple(value["value"])
                self.id_to_token[new_id] = v
                self.token_to_id[v] = new_id

    def encode(self, text: str, add_bos_eos: bool = False) -> list[int]:
        """
        TODO: 문자열을 token ID 리스트로 변환합니다.

        구현 힌트:
        - 먼저 UTF-8 byte ID 리스트를 만듭니다.
        - train/load에서 얻은 merge rule을 학습 순서대로 적용합니다.
        - add_bos_eos=True이면 앞뒤에 bos/eos ID를 붙입니다.
        """
        ids = [b + BYTE_OFFSET for b in text.encode("utf-8")]

        for i, pair in enumerate(self.merges):
            next_id = NUM_BYTES + BYTE_OFFSET + i
            ids = self._merge(ids, pair, next_id)

        if add_bos_eos:
            ids.insert(0, self.get_bos_id())
            ids.append(self.get_eos_id())
        
        return ids


    def decode(self, ids: list[int], skip_special: bool = True, errors: str = "strict",) -> str:
        """
        TODO: token ID 리스트를 문자열로 복원합니다.

        주의:
        - merge token은 원본 byte token까지 재귀적으로 펼칩니다.
        - byte를 하나씩 decode하지 말고, 마지막에 `bytes(...).decode("utf-8")`를 한 번만 호출합니다.
        """
        result = bytearray()
        for id in ids:
            if id in SPECIAL_IDS.values():
                if skip_special:
                    continue
                result.extend(self.id_to_token[id].encode("utf-8"))
                continue

            stack=[id]
            while stack:
                cur_id = stack.pop()
                token = self.id_to_token[cur_id]

                if isinstance(token, bytes):
                    result.extend(token)
                else:
                    left, right = token
                    stack.append(right)
                    stack.append(left)

        return bytes(result).decode("utf-8", errors=errors)
    
    def _count_pairs(self, ids: list[int]) -> Counter[tuple[int, int]]:
        counts = Counter()
        # 페어 개수 세기
        for pair in zip(ids, ids[1:]):
            counts[pair] += 1

        return counts
    
    def _merge(self, ids: list[int], pair: tuple[int, int], new_id: int) -> list[int]:
        i = 0
        result = list()
        while i < len(ids):
            if (i < len(ids) - 1) and (ids[i], ids[i+1]) == pair:
                result.append(new_id)
                i += 2
            else:
                result.append(ids[i])
                i += 1

        return result