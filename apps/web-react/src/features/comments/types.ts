export type PublicComment = {
  id: string;
  seatReviewId: string;
  author: {
    id: string;
    nickname: string;
  };
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CommentListResponse = {
  items: PublicComment[];
  total: number;
  sort: "oldest" | "latest";
};
