# PC·브라우저·스마트폰 연동 (Supabase)

지금 **크롬 / 웨일 / 스마트폰**마다 데이터가 따로 보인다면, Supabase가 설정되지 않은 상태입니다.  
아래 설정을 하면 **모든 기기·브라우저에서 같은 데이터**를 보게 됩니다.

---

## 연동되는 데이터 (기기·브라우저 간 동기화)

| 기능 | 설명 |
|------|------|
| **가계부** | 지출 내역, 카테고리 키워드, 월별 추가 키워드 |
| **일기장** | 일기 내용, 중요한 날 표시 |
| **오늘 마음에 남은 문장** | 인사이트(문장) 저장·문장 관리 |
| **유튜브** | 채널·수익, **재생목록**(플레이리스트 링크·순서·태그) |
| **루틴** | 루틴 항목, 일별 완료 체크 |
| **스케줄** | 일정 등록, 완료 체크, 날짜별 순서, 삭제한 시스템 일정 |
| **수입** | 수입 내역 (홈 위젯·수입 페이지) |
| **메모** | 포스트잇 메모 |
| **수면** | 기상/취침 시간 |
| **알림 팝업** | 샤워/헬스/유튜브 등 마지막 표시 시각(기기별 throttle 공유) |

---

## 1. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) 로그인 후 **New Project** 생성
2. 프로젝트가 준비되면 **Settings** → **API** 에서 확인:
   - **Project URL** (예: `https://xxxxx.supabase.co`)
   - **anon public** 키 (긴 JWT 문자열)

---

## 2. 프로젝트 루트에 `.env.local` 만들기

프로젝트 폴더(패키지가 있는 곳)에 `.env.local` 파일을 만들고 아래 두 줄을 **실제 값**으로 채웁니다.

```
NEXT_PUBLIC_SUPABASE_URL=https://여기에프로젝트URL.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...여기에anon키
```

- 예시는 `.env.local.example` 참고
- `.env.local`은 git에 올리지 마세요 (이미 .gitignore에 있음)

---

## 3. Supabase에 테이블 만들기

### 처음 한 번도 안 넣은 경우
1. Supabase 대시보드 → **SQL Editor** → New query
2. **supabase/schema.sql** 파일 내용을 **전부 복사**해서 붙여넣기 → **Run**

### 예전에 schema.sql 이미 넣은 적 있는 경우
**전체 schema.sql 다시 넣을 필요 없습니다.**  
**supabase/migration-add-sync-tables.sql** 내용만 복사해서 SQL Editor에서 실행하면, 부족한 테이블(스케줄 완료·순서·수입·메모·수면·알림 등)만 추가됩니다.

---

## 4. 개발 서버 다시 시작

- 터미널에서 `npm run dev` 중이었다면 **Ctrl+C**로 끄고, 다시 `npm run dev` 실행
- 환경 변수는 **서버를 다시 켜야** 반영됩니다

---

## 5. 배포(Vercel 등)에서 연동 쓰려면

배포할 때도 같은 Supabase를 쓰려면, 배포 사이트의 **Environment Variables**에 위 두 개(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)를 넣고 **다시 배포**해야 합니다.  
자세한 건 **DEPLOY.md** 참고.

---

설정이 끝나면 앱 상단의 "기기·브라우저 연동이 꺼져 있어요" 배너가 사라지고, 크롬·웨일·스마트폰에서 같은 데이터가 보입니다.
