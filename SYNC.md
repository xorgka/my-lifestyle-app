# PC·브라우저·스마트폰 연동 (Supabase)

지금 **크롬 / 웨일 / 스마트폰**마다 데이터가 따로 보인다면, Supabase가 설정되지 않은 상태입니다.  
아래 설정을 하면 **모든 기기·브라우저에서 같은 데이터**를 보게 됩니다.

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

1. Supabase 대시보드 → **SQL Editor**
2. 이 저장소의 **supabase/schema.sql** 파일 내용을 **전부 복사**해서 붙여넣기
3. **Run** 실행

(이미 다른 앱으로 테이블을 만든 적이 있으면, 필요한 테이블만 골라서 실행해도 됩니다.)

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
