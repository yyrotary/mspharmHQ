FROM node:20-alpine AS base

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 설치를 위한 파일 복사
COPY package.json package-lock.json ./

# 개발 의존성 포함한 모든 의존성 설치
FROM base AS dependencies
RUN npm ci

# 빌드 단계
FROM dependencies AS builder
COPY . .
RUN npm run build

# 실행 단계
FROM base AS runner

# 보안을 위한 비-루트 사용자 설정
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# 필요한 파일만 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 환경 변수 설정
ENV NODE_ENV production
ENV PORT 3000

# 포트 노출
EXPOSE 3000

# 애플리케이션 실행
CMD ["node", "server.js"] 