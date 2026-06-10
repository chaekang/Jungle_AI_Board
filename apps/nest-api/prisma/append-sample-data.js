require("dotenv").config();

const bcrypt = require("bcrypt");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before running append-sample-data.js.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

const prisma = createPrismaClient();

const additionalUsers = [
  { email: "orpheus.note@example.com", nickname: "오르페우스노트" },
  { email: "eurydice.view@example.com", nickname: "에우리디케뷰" },
  { email: "stageleft.kim@example.com", nickname: "좌블선호" },
  { email: "center.block@example.com", nickname: "중블집착러" },
  { email: "balcony.bee@example.com", nickname: "발코니비" },
  { email: "matinee.memo@example.com", nickname: "마티네메모" },
  { email: "weekend.seat@example.com", nickname: "주말관극러" },
  { email: "red.curtain@example.com", nickname: "붉은커튼" },
  { email: "frontrow.care@example.com", nickname: "앞열신중파" },
  { email: "sound.focus@example.com", nickname: "사운드우선" },
  { email: "ticket.diary@example.com", nickname: "티켓다이어리" },
  { email: "musical.map@example.com", nickname: "뮤지컬맵" },
  { email: "aisle.runner@example.com", nickname: "통로석사수" },
  { email: "double.cast@example.com", nickname: "회전문러" },
  { email: "encore.note@example.com", nickname: "앙콜기록장" },
];

const tagCatalog = {
  close_view: "seat_feature",
  full_stage: "seat_feature",
  balanced_sound: "seat_feature",
  side_view: "seat_feature",
  balcony_view: "seat_feature",
  first_timer: "viewing_purpose",
  repeat_viewing: "viewing_purpose",
  budget_pick: "viewing_purpose",
};

const reviewSpecs = [
  {
    authorIndex: 0,
    theaterName: "샤롯데씨어터",
    musicalTitle: "하데스타운",
    seatFloor: "1층",
    seatSection: "중블",
    seatRow: "F",
    seatNumber: "14",
    viewRating: 5,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 5,
    stageVisibilityRating: 5,
    tags: ["close_view", "balanced_sound", "repeat_viewing"],
    content:
      "샤롯데 1층 중블 F열 하데스타운 보고 옴. 여기 진짜 시야 너무 예뻐서 첫 넘버 시작하자마자 아 잘 잡았다 싶었다. 배우 표정이랑 눈빛 다 잡히고 군무 들어올 때도 무대 중심이 안 흐트러져서 회전문 도는 이유를 알겠는 자리.",
  },
  {
    authorIndex: 1,
    theaterName: "샤롯데씨어터",
    musicalTitle: "하데스타운",
    seatFloor: "1층",
    seatSection: "좌블",
    seatRow: "L",
    seatNumber: "6",
    viewRating: 4,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 4,
    stageVisibilityRating: 4,
    tags: ["side_view", "balanced_sound"],
    content:
      "좌블 L열이라 아주 정면 맛은 아니지만 생각보다 훨씬 괜찮았다. 샤롯데는 사이드여도 무대 폭이 정리돼 보여서 하데스타운 같은 감정극은 오히려 배우 시선 따라가기 좋더라. 반대편 끝 동선만 아주 살짝 아쉬운 정도.",
  },
  {
    authorIndex: 2,
    theaterName: "샤롯데씨어터",
    musicalTitle: "하데스타운",
    seatFloor: "2층",
    seatSection: "중블",
    seatRow: "B",
    seatNumber: "19",
    viewRating: 4,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 5,
    tags: ["full_stage", "balcony_view", "first_timer"],
    content:
      "2층 중블 B열은 하데스타운 전체 톤 보기 진짜 좋다. 표정 디테일은 오글 있으면 더 좋겠지만 조명 갈리는 맛, 세트 깊이감, 군무 선 정리되는 게 너무 잘 보여서 초회면 오히려 만족도 높을 듯. 앞사람 머리 스트레스도 거의 없었음.",
  },
  {
    authorIndex: 3,
    theaterName: "샤롯데씨어터",
    musicalTitle: "하데스타운",
    seatFloor: "2층",
    seatSection: "우블",
    seatRow: "A",
    seatNumber: "8",
    viewRating: 4,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 4,
    tags: ["side_view", "balcony_view", "budget_pick"],
    content:
      "2층 우블 앞열인데 생각보다 안 멀다. 난간도 심하게 거슬리진 않았고 우측에서 들어오는 동선이 잘 살아서 나름의 맛이 있음. 대신 반대편 끝 포인트는 한 박자 늦게 보일 수 있어서 완전 정면 덕질석 찾는 사람이면 중블이 더 맞을 듯.",
  },
  {
    authorIndex: 4,
    theaterName: "샤롯데씨어터",
    musicalTitle: "하데스타운",
    seatFloor: "1층",
    seatSection: "중블",
    seatRow: "R",
    seatNumber: "18",
    viewRating: 4,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 5,
    tags: ["full_stage", "balanced_sound"],
    content:
      "1층 뒤중블 R열이면 표정은 앞열보다 덜하지만 무대 전체 밸런스가 진짜 좋다. 샤롯데가 뒤로 가도 시야가 꽤 편안한 편이라 하데스타운 조명 합이랑 장면 전환 보기에 아주 만족. 편하게 한 번 더 보러 가고 싶은 자리였음.",
  },
  {
    authorIndex: 5,
    theaterName: "샤롯데씨어터",
    musicalTitle: "드라큘라",
    seatFloor: "1층",
    seatSection: "중블",
    seatRow: "D",
    seatNumber: "16",
    viewRating: 5,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 5,
    stageVisibilityRating: 5,
    tags: ["close_view", "balanced_sound", "repeat_viewing"],
    content:
      "드라큘라는 무조건 표정 봐야 하는데 1층 중블 D열이면 진짜 끝났다. 얼굴 근육 쓰는 거까지 보이고 저음 넘버 때 성량이 객석으로 쫙 밀려오는데 답답함이 없다. 이 자리는 인터 끝나고도 심장 안 내려옴.",
  },
  {
    authorIndex: 6,
    theaterName: "샤롯데씨어터",
    musicalTitle: "드라큘라",
    seatFloor: "1층",
    seatSection: "우블",
    seatRow: "K",
    seatNumber: "7",
    viewRating: 4,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 4,
    stageVisibilityRating: 4,
    tags: ["side_view", "close_view"],
    content:
      "우블 K열 드라큘라 생각보다 맛있다. 측면 동선이 잘 보여서 등장 장면이 꽤 임팩트 있고, 반대편 끝 장치만 아주 살짝 겹쳐 보이는 정도라 흐름 깨질 정도는 아님. 사이드석인데도 몰입 잘 돼서 의외로 만족.",
  },
  {
    authorIndex: 7,
    theaterName: "샤롯데씨어터",
    musicalTitle: "드라큘라",
    seatFloor: "2층",
    seatSection: "중블",
    seatRow: "C",
    seatNumber: "21",
    viewRating: 4,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 5,
    tags: ["full_stage", "balcony_view", "first_timer"],
    content:
      "2층 중블 C열이면 드라큘라 특유의 고딕 무드가 한 번에 들어온다. 표정은 망원경 있으면 훨씬 좋겠지만 세트, 조명, 망토 휘날리는 선이 다 정리돼 보여서 작품 전체 분위기 먹기에는 아주 좋은 자리. 초회한테 추천 가능.",
  },
  {
    authorIndex: 8,
    theaterName: "샤롯데씨어터",
    musicalTitle: "드라큘라",
    seatFloor: "2층",
    seatSection: "좌블",
    seatRow: "A",
    seatNumber: "4",
    viewRating: 3,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 4,
    tags: ["side_view", "budget_pick"],
    content:
      "2층 좌블 앞열은 각도는 분명 있지만 가격 생각하면 꽤 괜찮다. 중앙 명장면 터질 때 입체감 있게 들어오는 맛이 있고, 드라큘라처럼 무대 그림 큰 작품은 멀리서 봐도 서사 따라가기에 무리 없다. 가성비로는 충분히 추천.",
  },
  {
    authorIndex: 9,
    theaterName: "두산아트센터",
    musicalTitle: "어쩌면 해피엔딩",
    seatFloor: "1층",
    seatSection: "중앙",
    seatRow: "C",
    seatNumber: "11",
    viewRating: 5,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 5,
    stageVisibilityRating: 5,
    tags: ["close_view", "balanced_sound", "repeat_viewing"],
    content:
      "두산 1층 중앙 C열에서 어해 봤는데 이건 그냥 표정석이다. 작은 눈빛 변화랑 머뭇거림이 다 보여서 마지막 장면까지 감정이 너무 세게 들어온다. 객석이 과하게 멀지 않아서 대사, 호흡, 넘버 다 또렷하게 꽂힘.",
  },
  {
    authorIndex: 10,
    theaterName: "두산아트센터",
    musicalTitle: "어쩌면 해피엔딩",
    seatFloor: "1층",
    seatSection: "좌측",
    seatRow: "H",
    seatNumber: "5",
    viewRating: 4,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 4,
    stageVisibilityRating: 4,
    tags: ["side_view", "balanced_sound"],
    content:
      "좌측 H열 어해는 사이드 치고 되게 편했다. 무대가 깊지 않아서 시야 손해가 크지 않고 배우들 동선이랑 소품 쓰는 손끝이 잘 읽힌다. 잔잔한 작품이라 오히려 이런 자리에서 조용히 몰입하기 좋았음.",
  },
  {
    authorIndex: 11,
    theaterName: "두산아트센터",
    musicalTitle: "어쩌면 해피엔딩",
    seatFloor: "2층",
    seatSection: "중앙",
    seatRow: "A",
    seatNumber: "9",
    viewRating: 4,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 5,
    tags: ["full_stage", "balcony_view", "first_timer"],
    content:
      "2층 중앙 A열은 어해 무대 구도를 진짜 예쁘게 볼 수 있다. 표정 덕질은 1층이 낫지만 위에서 보면 장면 전환이랑 동선이 정리돼서 이야기 따라가기가 엄청 편함. 초회로는 생각보다 훨씬 좋은 선택.",
  },
  {
    authorIndex: 12,
    theaterName: "두산아트센터",
    musicalTitle: "어쩌면 해피엔딩",
    seatFloor: "1층",
    seatSection: "우측",
    seatRow: "M",
    seatNumber: "14",
    viewRating: 4,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 4,
    stageVisibilityRating: 4,
    tags: ["side_view", "budget_pick"],
    content:
      "1층 우측 M열은 완전 정중앙 느낌은 아니어도 어해 보기엔 충분히 좋다. 반대편 끝 연출만 조금 비껴 보일 뿐 배우 거리감이 멀지 않아서 감정 따라가기는 전혀 문제 없었음. 가격 생각하면 꽤 알찬 자리.",
  },
  {
    authorIndex: 13,
    theaterName: "두산아트센터",
    musicalTitle: "어쩌면 해피엔딩",
    seatFloor: "2층",
    seatSection: "좌측",
    seatRow: "B",
    seatNumber: "3",
    viewRating: 3,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 4,
    tags: ["balcony_view", "budget_pick"],
    content:
      "2층 좌측 B열은 정면 디테일보단 전체 무드 감상용. 그래도 어해는 무대가 복잡하지 않아서 위에서 보면 한 컷처럼 잘 정리되고, 감정 흐름 놓칠 일은 없었다. 가볍게 한 번 볼 사람한텐 꽤 괜찮은 가성비석.",
  },
  {
    authorIndex: 14,
    theaterName: "두산아트센터",
    musicalTitle: "어쩌면 해피엔딩",
    seatFloor: "1층",
    seatSection: "중앙",
    seatRow: "R",
    seatNumber: "18",
    viewRating: 4,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 5,
    tags: ["full_stage", "balanced_sound"],
    content:
      "1층 뒤중앙 R열은 어해 전체 그림 보기 딱 좋다. 앞열처럼 숨소리까지 잡히는 느낌은 아니지만 무대가 한눈에 들어오고 시야에 거슬리는 게 거의 없어서 마지막까지 집중력이 안 끊긴다. 편안한 회전문석 느낌.",
  },
  {
    authorIndex: 0,
    theaterName: "두산아트센터",
    musicalTitle: "어쩌면 해피엔딩",
    seatFloor: "1층",
    seatSection: "우측",
    seatRow: "E",
    seatNumber: "2",
    viewRating: 4,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 4,
    stageVisibilityRating: 4,
    tags: ["close_view", "balanced_sound"],
    content:
      "앞쪽 우측 E열이라 배우 가까이 왔을 때 심장 진짜 바빠진다. 아주 정중앙은 아니라 반대편 끝 연출은 살짝 비껴 보이는데, 두산이 워낙 무대랑 객석 거리가 가까워서 감정선 먹기엔 오히려 이 정도도 너무 좋았음.",
  },
  {
    authorIndex: 1,
    theaterName: "두산아트센터",
    musicalTitle: "베어더뮤지컬",
    seatFloor: "1층",
    seatSection: "중앙",
    seatRow: "G",
    seatNumber: "12",
    viewRating: 5,
    soundRating: 5,
    comfortRating: 4,
    expressionRating: 5,
    stageVisibilityRating: 5,
    tags: ["close_view", "balanced_sound", "repeat_viewing"],
    content:
      "베어는 감정 부딪히는 장면을 가까이서 봐야 제맛인데 1층 중앙 G열이 딱 그 느낌이다. 표정이랑 합창 에너지가 같이 밀려와서 넘버 하나하나 체감이 크고, 조용한 독백도 또렷하게 꽂혀서 끝나고 한참 멍했다.",
  },
  {
    authorIndex: 2,
    theaterName: "두산아트센터",
    musicalTitle: "베어더뮤지컬",
    seatFloor: "1층",
    seatSection: "좌측",
    seatRow: "J",
    seatNumber: "4",
    viewRating: 4,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 4,
    stageVisibilityRating: 4,
    tags: ["side_view", "balanced_sound"],
    content:
      "좌측 J열은 몇 장면에서 몸 살짝 틀게 되긴 하는데 불편할 정도는 아니다. 베어는 인물 감정선이 강해서 오히려 사이드에서 시선 방향 따라가는 재미가 있었고, 음향도 거칠게 튀지 않아서 몰입 깨지지 않았음.",
  },
  {
    authorIndex: 3,
    theaterName: "두산아트센터",
    musicalTitle: "베어더뮤지컬",
    seatFloor: "2층",
    seatSection: "중앙",
    seatRow: "A",
    seatNumber: "6",
    viewRating: 4,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 5,
    tags: ["full_stage", "balcony_view", "first_timer"],
    content:
      "2층 중앙 A열은 베어 전체 무대 쓰는 방식이 한 번에 보여서 좋았다. 표정 디테일은 조금 멀어도 단체 장면이랑 조명 합은 오히려 여기서 더 잘 보임. 초회로 작품 흐름 읽기에는 꽤 괜찮은 자리.",
  },
  {
    authorIndex: 4,
    theaterName: "홍익대 대학로 아트센터",
    musicalTitle: "이프덴",
    seatFloor: "1층",
    seatSection: "중블",
    seatRow: "H",
    seatNumber: "15",
    viewRating: 5,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 4,
    stageVisibilityRating: 5,
    tags: ["full_stage", "balanced_sound", "repeat_viewing"],
    content:
      "홍아센 1층 중블 H열 이프덴은 밸런스 진짜 좋다. 무대 폭 넓은 작품이라 너무 앞보단 이 정도가 훨씬 편하고, 군무랑 개인 감정선이 번갈아 올 때 시선이 안 바빠서 몰입하기 좋았음. 전체 그림이 예쁘게 잡힌다.",
  },
  {
    authorIndex: 5,
    theaterName: "홍익대 대학로 아트센터",
    musicalTitle: "이프덴",
    seatFloor: "1층",
    seatSection: "우블",
    seatRow: "N",
    seatNumber: "8",
    viewRating: 4,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 4,
    tags: ["side_view", "budget_pick"],
    content:
      "1층 우블 뒤쪽인데 생각보다 답답하지 않았다. 홍아센이 무대가 커서 사이드면 손해 클 줄 알았는데 주동선은 충분히 따라가고 큰 장면도 시야가 막 끊기진 않음. 가격 대비 만족도 꽤 높은 편.",
  },
  {
    authorIndex: 6,
    theaterName: "홍익대 대학로 아트센터",
    musicalTitle: "이프덴",
    seatFloor: "2층",
    seatSection: "중블",
    seatRow: "A",
    seatNumber: "11",
    viewRating: 4,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 5,
    tags: ["full_stage", "balcony_view", "first_timer"],
    content:
      "2층 중블 A열은 이프덴 무대 구조 보는 맛이 있다. 표정 덕질은 1층이 낫지만 위에서 보면 장면 전환이랑 군무 선이 정리돼서 작품 이해가 쉬움. 복잡한 장면도 안 헷갈려서 초회에 잘 맞는 자리였다.",
  },
  {
    authorIndex: 7,
    theaterName: "홍익대 대학로 아트센터",
    musicalTitle: "이프덴",
    seatFloor: "2층",
    seatSection: "좌블",
    seatRow: "C",
    seatNumber: "5",
    viewRating: 3,
    soundRating: 4,
    comfortRating: 4,
    expressionRating: 3,
    stageVisibilityRating: 4,
    tags: ["side_view", "balcony_view", "budget_pick"],
    content:
      "2층 좌블 C열은 정면감은 좀 덜하지만 공연 흐름 놓칠 정도는 전혀 아니다. 무대 왼편 동선은 잘 보이고 반대편 끝은 살짝 각도 생기는 정도라, 서사 따라가기엔 무난했다. 가볍게 한 번 보기 좋은 자리.",
  },
];

async function ensureAuthorPool() {
  const existingUsers = await prisma.user.findMany({
    orderBy: { id: "asc" },
  });

  const passwordHash = await bcrypt.hash("password1234", 10);
  const authorPool = [...existingUsers];

  for (const user of additionalUsers) {
    if (authorPool.length >= 15) {
      break;
    }

    const existing =
      authorPool.find((candidate) => candidate.email === user.email)
      ?? (await prisma.user.findUnique({ where: { email: user.email } }));

    if (existing) {
      if (!authorPool.find((candidate) => candidate.id === existing.id)) {
        authorPool.push(existing);
      }
      continue;
    }

    const created = await prisma.user.create({
      data: {
        email: user.email,
        nickname: user.nickname,
        passwordHash,
      },
    });

    authorPool.push(created);
  }

  if (authorPool.length < 15) {
    throw new Error(`Need at least 15 users, but only found ${authorPool.length}.`);
  }

  return authorPool.slice(0, 15);
}

async function ensureTheater(name) {
  const existing = await prisma.theater.findUnique({
    where: { name },
  });

  if (existing) {
    return existing;
  }

  return prisma.theater.create({
    data: { name },
  });
}

async function ensureMusical(title) {
  const existing = await prisma.musical.findFirst({
    where: { title },
  });

  if (existing) {
    return existing;
  }

  return prisma.musical.create({
    data: { title },
  });
}

async function ensurePerformance(musicalId, theaterId) {
  const existing = await prisma.performance.findFirst({
    where: {
      musicalId,
      theaterId,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.performance.create({
    data: {
      musicalId,
      theaterId,
    },
  });
}

async function ensureTag(name, type) {
  const existing = await prisma.tag.findFirst({
    where: { name, type },
  });

  if (existing) {
    return existing;
  }

  return prisma.tag.create({
    data: { name, type },
  });
}

async function syncReview(spec, author, theater, musical, performance, tagsByName) {
  const existing = await prisma.seatReview.findFirst({
    where: {
      authorId: author.id,
      theaterId: theater.id,
      musicalId: musical.id,
      performanceId: performance.id,
      seatFloor: spec.seatFloor,
      seatSection: spec.seatSection,
      seatRow: spec.seatRow,
      seatNumber: spec.seatNumber,
    },
  });

  const reviewData = {
    authorId: author.id,
    theaterId: theater.id,
    musicalId: musical.id,
    performanceId: performance.id,
    seatFloor: spec.seatFloor,
    seatSection: spec.seatSection,
    seatRow: spec.seatRow,
    seatNumber: spec.seatNumber,
    viewRating: spec.viewRating,
    soundRating: spec.soundRating,
    comfortRating: spec.comfortRating,
    expressionRating: spec.expressionRating,
    stageVisibilityRating: spec.stageVisibilityRating,
    content: spec.content,
  };

  const review = existing
    ? await prisma.seatReview.update({
        where: { id: existing.id },
        data: reviewData,
      })
    : await prisma.seatReview.create({
        data: reviewData,
      });

  const tagIds = spec.tags.map((tagName) => {
    const tag = tagsByName.get(tagName);

    if (!tag) {
      throw new Error(`Unknown tag requested: ${tagName}`);
    }

    return tag.id;
  });

  if (tagIds.length > 0) {
    await prisma.seatReviewTag.createMany({
      data: tagIds.map((tagId) => ({
        seatReviewId: review.id,
        tagId,
      })),
      skipDuplicates: true,
    });
  }

  return { review, existed: Boolean(existing) };
}

async function main() {
  const authors = await ensureAuthorPool();

  const tagsByName = new Map();
  for (const [name, type] of Object.entries(tagCatalog)) {
    const tag = await ensureTag(name, type);
    tagsByName.set(name, tag);
  }

  const comboCache = new Map();
  let insertedReviews = 0;
  let updatedReviews = 0;

  for (const spec of reviewSpecs) {
    const comboKey = `${spec.theaterName}::${spec.musicalTitle}`;
    let combo = comboCache.get(comboKey);

    if (!combo) {
      const theater = await ensureTheater(spec.theaterName);
      const musical = await ensureMusical(spec.musicalTitle);
      const performance = await ensurePerformance(musical.id, theater.id);
      combo = { theater, musical, performance };
      comboCache.set(comboKey, combo);
    }

    const { existed } = await syncReview(
      spec,
      authors[spec.authorIndex],
      combo.theater,
      combo.musical,
      combo.performance,
      tagsByName,
    );

    if (existed) {
      updatedReviews += 1;
    } else {
      insertedReviews += 1;
    }
  }

  const summary = {};

  for (const [comboKey, combo] of comboCache.entries()) {
    summary[comboKey] = await prisma.seatReview.count({
      where: {
        theaterId: combo.theater.id,
        musicalId: combo.musical.id,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        authorsUsed: authors.length,
        insertedReviews,
        updatedReviews,
        summary,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("append-sample-data failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
