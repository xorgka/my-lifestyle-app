# Vercel 배포 가이드

## 1. 코드를 GitHub에 올리기

프로젝트가 아직 GitHub에 없다면:

```bash
git init
git add .
git commit -m "Initial commit"
# GitHub에서 새 저장소(my-lifestyle-app 등) 만든 뒤
git remote add origin https://github.com/내아이디/저장소이름.git
git branch -M main
git push -u origin main
```

이미 저장소가 있으면 `git push` 만 하면 됩니다.

---

## 2. Vercel에서 프로젝트 가져오기

1. [vercel.com](https://vercel.com) 접속 후 로그인 (GitHub 계정 연동 권장)
2. **Add New…** → **Project**
3. **Import Git Repository**에서 이 프로젝트 저장소 선택
4. **Import** 클릭
5. **Configure Project** 화면에서
   - Framework Preset: **Next.js** (자동 감지됨)
   - Root Directory: 비워 두기
   - Build Command: `next build` (기본값)
   - Output Directory: 비워 두기 (기본값)
6. **Environment Variables** 섹션으로 내려가기 (아래 3번에서 설정)

---

## 3. 환경 변수 넣는 위치 (중요)

**Configure Project** 화면에서 **Environment Variables** 영역에 다음 두 개를 추가합니다.

| Name | Value | 적용 환경 |
|------|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`에 있는 **Project URL** 전체 (예: `https://xxxx.supabase.co`) | Production, Preview, Development 모두 체크 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`에 있는 **Anon Key** 전체 (긴 JWT 문자열) | Production, Preview, Development 모두 체크 |

- **Name**: 위 표의 이름을 **그대로** 입력 (복사·붙여넣기 권장)
- **Value**: 본인 Supabase 대시보드에서 복사한 실제 값 붙여넣기 (공백 없이)
- **Environment**: Production, Preview, Development **세 개 다 체크** 해두면 배포·미리보기 모두 동작

이미 배포한 뒤에 넣고 싶다면:

1. Vercel 대시보드 → 해당 프로젝트 클릭
2. 상단 **Settings** 탭
3. 왼쪽 메뉴 **Environment Variables**
4. **Add** 또는 **Key** / **Value** 입력 후 저장
5. **Redeploy** (Deployments → ⋮ → Redeploy) 해야 새 값이 반영됨

---

## 4. 배포 실행

**Environment Variables**까지 넣었다면 **Deploy** 버튼 클릭.

빌드가 끝나면 **Visit** 로 배포된 주소(예: `https://my-lifestyle-app-xxx.vercel.app`)로 들어갈 수 있습니다. 이 주소를 핸드폰 브라우저에 넣거나, **Add to Home Screen** 하면 앱처럼 쓸 수 있습니다.

---

## 5. 이후 수정사항 반영

코드 수정 후 `git push` 하면 Vercel이 자동으로 다시 빌드·배포합니다. 환경 변수는 한 번 설정해 두면 그대로 유지됩니다.

---

## 요약 체크리스트

- [ ] GitHub에 코드 push
- [ ] Vercel에서 해당 저장소 Import
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 추가 (Production·Preview·Development 체크)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가 (Production·Preview·Development 체크)
- [ ] Deploy 후 배포 URL에서 가계부/일기 동작 확인
