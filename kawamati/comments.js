function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// 自分が投稿したコメントのIDをsessionStorageで管理
function getMyCommentIds() {
    return JSON.parse(sessionStorage.getItem('my_comment_ids') || '[]');
}

function saveMyCommentId(id) {
    const ids = getMyCommentIds();
    ids.push(id);
    sessionStorage.setItem('my_comment_ids', JSON.stringify(ids));
}

async function renderComments(projectId) {
    const list = document.getElementById('comments-' + projectId);
    if (!list) return;

    list.innerHTML = '<p class="no-comments">読み込み中...</p>';

    try {
        const snapshot = await db
            .collection('comments')
            .doc(projectId)
            .collection('entries')
            .orderBy('timestamp', 'asc')
            .get();

        const myIds = getMyCommentIds();

        if (snapshot.empty) {
            list.innerHTML = '<p class="no-comments">まだコメントはありません。最初のコメントを書いてみましょう！</p>';
            return;
        }

        list.innerHTML = snapshot.docs.map(docSnap => {
            const c = docSnap.data();
            const canDelete = myIds.includes(c.sessionCommentId);
            return `
            <div class="comment-item">
                <div class="comment-meta">
                    <span class="comment-name">${escapeHtml(c.name)}</span>
                    <span class="comment-date">${escapeHtml(c.date)}</span>
                    ${canDelete ? `<button class="comment-delete" onclick="deleteComment('${escapeHtml(projectId)}', '${docSnap.id}')">削除</button>` : ''}
                </div>
                <p class="comment-text">${escapeHtml(c.text)}</p>
            </div>`;
        }).join('');

    } catch (e) {
        list.innerHTML = '<p class="no-comments">コメントの読み込みに失敗しました。</p>';
        console.error('renderComments error:', e);
    }
}

async function deleteComment(projectId, docId) {
    if (!confirm('このコメントを削除しますか？')) return;
    try {
        await db
            .collection('comments')
            .doc(projectId)
            .collection('entries')
            .doc(docId)
            .delete();
        renderComments(projectId);
    } catch (e) {
        alert('削除に失敗しました。');
        console.error('deleteComment error:', e);
    }
}

async function addComment(projectId) {
    const nameEl = document.getElementById('name-' + projectId);
    const textEl = document.getElementById('text-' + projectId);
    const submitBtn = document.querySelector(`button[onclick="addComment('${projectId}')"]`);

    const text = textEl.value.trim();
    if (!text) {
        alert('コメントを入力してください。');
        return;
    }

    const name = nameEl.value.trim() || '匿名';
    const now = new Date();
    const date = now.toLocaleDateString('ja-JP') + ' ' + now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const sessionCommentId = generateId();

    if (submitBtn) submitBtn.disabled = true;

    try {
        await db
            .collection('comments')
            .doc(projectId)
            .collection('entries')
            .add({
                name,
                text,
                date,
                sessionCommentId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

        saveMyCommentId(sessionCommentId);
        nameEl.value = '';
        textEl.value = '';
        renderComments(projectId);
    } catch (e) {
        alert('コメントの送信に失敗しました。');
        console.error('addComment error:', e);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.comment-section[data-project-id]').forEach(el => {
        renderComments(el.dataset.projectId);
    });
});
