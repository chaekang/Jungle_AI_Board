import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { PerformanceQueryDto } from "./dto/performance-query.dto";

// 화면에서 선택지로 쓸 메타데이터를 DB에서 가져오는 서비스
@Injectable()  // 이 클래스를 서비스로 관리할 수 있도록 함
export class MetadataService {
    constructor(private readonly prisma: PrismaService) {}

    async getTheaters() {
        const theaters = await this.prisma.theater.findMany({
            orderBy: {name: "asc"}  // name 기준 오름차순 정렬
        })

        // DB에서 가져온 데이터를 프론트가 쓰기 쉬운 모양으로 바꿔서 반환함({id, name})
        return theaters.map((theater) => ({
            id: theater.id.toString(),
            name: theater.name
        }))
    }

    async getMusicals() {
        const musicals = await this.prisma.musical.findMany({
            orderBy: {title: "asc"}
        })

        return musicals.map((musical) => ({
            id: musical.id.toString(),
            name: musical.title
        }))
    }

    
    async getPerformances(query: PerformanceQueryDto) {   // 컨트롤러에서 받은 쿼리 파라미터가 들어옴
        // 조건이 있을때만 Prisma 검색 조건에 넣음
        const where = {
            ...(query.theaterId ? {theaterId : BigInt(query.theaterId)} : {}),
            ...(query.musicalId ? {musicalId : BigInt(query.musicalId)} : {})
        };

        // 공연 목록 조회
        const performances = await this.prisma.performance.findMany({
            where,   // 위에서 만든 필터 조건
            include: {   // performances와 연결된 theater, musical 정보도 같이 가져옴
                theater: true,
                musical: true
            },
            orderBy: [{ theater: {name : "asc"}}, {musical: {title: "asc"}}]
        });

        return performances.map((performance) => ({
            id: performance.id.toString(),
            theaterId: performance.theaterId.toString(),
            theaterName: performance.theater.name,
            musicalId: performance.musicalId.toString(),
            musicalTitle: performance.musical.title
        }));
    }
}