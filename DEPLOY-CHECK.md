# 배포 반영 안 될 때 체크리스트

로컬에서는 되는데 `git push` 후 온라인에 반영이 안 되면 아래를 **순서대로** 확인하세요.

---

## 1. Git 명령을 **이 폴더**에서 실행했는지

반드시 프로젝트 폴더에서 터미널을 열고 실행하세요.

```powershell
cd "c:\Users\xorgk\Downloads\my-lifestyle-app"
git status
```

- `src/app/income/page.tsx`, `src/lib/budget.ts` 등이 **수정됨(modified)** 으로 나와야 합니다.
- 아무것도 안 나오면 → **다른 폴더**에서 git을 실행한 겁니다. Cursor에서 연 이 폴더에서 하세요.

---

## 2. 커밋에 파일이 들어갔는지

```powershell
git add .
git status
```

- 변경된 파일들이 "커밋할 변경 사항"에 나와야 합니다.

```powershell
git commit -m "update"
git log -1 --name-only
```

- `src/app/income/page.tsx`, `src/lib/budget.ts` 등이 목록에 **있어야** 합니다.
- 없으면 → 그 커밋에는 수정 내용이 안 들어간 겁니다. 다시 `git add .` 하고 커밋하세요.

---

## 3. 푸시한 저장소가 Vercel이 보는 곳인지

```powershell
git remote -v
```

- `origin` 이 가리키는 URL을 확인하세요 (예: `https://github.com/내아이디/my-lifestyle-app.git`).

**Vercel 대시보드**에서:

1. 해당 프로젝트 선택
2. **Settings** → **Git**
3. **Connected Git Repository** 에 나온 저장소 URL이 위에서 본 `origin` URL과 **완전히 같은지** 확인

- 다르면 → 지금 푸시하는 repo와 Vercel이 배포하는 repo가 다른 겁니다.  
  - Vercel에 연결된 그 저장소로 이 폴더를 push 하거나,  
  - 이 폴더를 Vercel이 연결한 저장소로 맞춰서 사용해야 합니다.

---

## 4. 푸시한 브랜치가 Vercel 프로덕션 브랜치인지

```powershell
git branch
```

- 지금 사용 중인 브랜치 이름 확인 (보통 `main` 또는 `master`).

**Vercel** → **Settings** → **Git** → **Production Branch**

- 여기 적힌 브랜치가 위에서 확인한 브랜치와 **같아야** 합니다.
- 예: Production Branch가 `main`인데, 로컬에서 `master`만 push 하고 있으면 프로덕션 배포가 안 됩니다. `main`에 push 하세요.

```powershell
git push origin main
```

- 브랜치 이름이 `master`면 `git push origin master` 로 하세요.

---

## 5. Vercel 배포가 성공했는지

**Vercel 대시보드** → **Deployments**

- 가장 위에 있는 배포:
  - **Status**가 **Ready** (초록)인지
  - **Commit** 메시지가 방금 push 한 "update" 인지
  - **Commit**을 눌러서 커밋 해시가 로컬 `git log -1` 과 같은지

**실패(Error/Canceled)** 로 나오면:

- 그 배포 클릭 → **Building** 로그 확인
- 에러 메시지 보고 수정한 뒤 다시 push

배포가 **성공**했는데도 화면이 안 바뀌면 → 6번으로.

---

## 6. 캐시 / 브라우저

- 브라우저에서 **시크릿(프라이빗) 창**으로 배포 URL 열기
- 또는 **Ctrl+Shift+R** (강력 새로고침)
- 그래도 예전 화면이면: **Vercel** → **Deployments** → 맨 위 배포 **⋮** → **Redeploy** → **Redeploy with existing Build Cache** 끄고 재배포

---

## 요약

| 확인 항목 | 확인 방법 |
|----------|-----------|
| 올바른 폴더에서 git 실행 | `cd` 로 `my-lifestyle-app` 폴더로 이동 후 `git status` |
| 커밋에 수정 파일 포함 | `git log -1 --name-only` 에 income, budget 등 있음 |
| Vercel 연결 repo = push 하는 repo | `git remote -v` 와 Vercel Git 설정이 동일 |
| 푸시 브랜치 = Production Branch | `git branch` 와 Vercel Production Branch 일치 |
| 배포 성공 | Deployments 에서 Ready, 최신 커밋으로 배포됨 |
| 캐시 제거 | 시크릿 창 / 강력 새로고침 / Redeploy 시 캐시 비우기 |

위 단계 중 어디서 막히는지 알려주시면, 그 다음만 집중해서 해결할 수 있습니다.
