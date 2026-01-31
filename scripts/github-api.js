// GitHub API 配置和操作
class GitHubManager {
    constructor() {
        this.token = localStorage.getItem('github_token') || '';
        this.repoOwner = localStorage.getItem('github_repo_owner') || '';
        this.repoName = localStorage.getItem('github_repo_name') || '';
        this.repoBranch = localStorage.getItem('github_repo_branch') || 'main';
        this.dataPath = 'data/articles.json';
        this.apiBase = 'https://api.github.com';
    }

    // 保存配置
    saveConfig(token, owner, name, branch) {
        localStorage.setItem('github_token', token);
        localStorage.setItem('github_repo_owner', owner);
        localStorage.setItem('github_repo_name', name);
        localStorage.setItem('github_repo_branch', branch);
        
        this.token = token;
        this.repoOwner = owner;
        this.repoName = name;
        this.repoBranch = branch;
        
        return this.isConfigured();
    }

    // 检查是否配置完成
    isConfigured() {
        return this.token && this.repoOwner && this.repoName;
    }

    // 显示配置状态
    showConfigStatus() {
        const statusDiv = document.getElementById('githubStatus');
        if (!this.isConfigured()) {
            statusDiv.innerHTML = `
                <div style="color: #f44336;">
                    <i class="fas fa-exclamation-triangle"></i> 
                    GitHub配置未完成！请填写所有信息。
                </div>
            `;
            statusDiv.style.display = 'block';
            return false;
        }
        
        statusDiv.innerHTML = `
            <div style="color: #4CAF50;">
                <i class="fas fa-check-circle"></i> 
                GitHub已配置！仓库：${this.repoOwner}/${this.repoName}
            </div>
        `;
        statusDiv.style.display = 'block';
        return true;
    }

    // 测试连接
    async testConnection() {
        if (!this.isConfigured()) {
            throw new Error('请先完成GitHub配置');
        }

        try {
            const response = await fetch(`${this.apiBase}/repos/${this.repoOwner}/${this.repoName}`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const repoInfo = await response.json();
                return {
                    success: true,
                    message: `✓ 连接成功！仓库：${repoInfo.full_name}`,
                    repo: repoInfo
                };
            } else {
                throw new Error(`GitHub API错误：${response.status}`);
            }
        } catch (error) {
            throw new Error(`连接失败：${error.message}`);
        }
    }

    // 从GitHub获取文章
    async fetchArticles() {
        if (!this.isConfigured()) {
            console.log('GitHub未配置，使用本地存储');
            return JSON.parse(localStorage.getItem('fuwakoArticles') || '[]');
        }

        try {
            // 获取文件内容
            const response = await fetch(
                `${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/contents/${this.dataPath}?ref=${this.repoBranch}`,
                {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            if (response.status === 404) {
                console.log('文章文件不存在，创建新文件');
                return [];
            }

            if (!response.ok) {
                throw new Error(`获取失败：${response.status}`);
            }

            const fileData = await response.json();
            const content = atob(fileData.content); // base64解码
            return JSON.parse(content || '[]');
            
        } catch (error) {
            console.error('从GitHub获取文章失败：', error);
            // 失败时使用本地存储
            return JSON.parse(localStorage.getItem('fuwakoArticles') || '[]');
        }
    }

    // 保存文章到GitHub
    async saveArticles(articles) {
        // 先保存到本地存储作为备份
        localStorage.setItem('fuwakoArticles', JSON.stringify(articles));

        if (!this.isConfigured()) {
            console.log('GitHub未配置，仅保存到本地');
            return { success: true, message: '文章已保存到本地（GitHub未配置）' };
        }

        try {
            // 先检查文件是否存在
            let sha = null;
            try {
                const getResponse = await fetch(
                    `${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/contents/${this.dataPath}?ref=${this.repoBranch}`,
                    {
                        headers: {
                            'Authorization': `token ${this.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (getResponse.ok) {
                    const fileData = await getResponse.json();
                    sha = fileData.sha;
                }
            } catch (e) {
                // 文件不存在是正常的，sha保持null
            }

            // 创建或更新文件
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(articles, null, 2))));
            const response = await fetch(
                `${this.apiBase}/repos/${this.repoOwner}/${this.repoName}/contents/${this.dataPath}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `更新日记 - ${new Date().toLocaleString('zh-CN')}`,
                        content: content,
                        branch: this.repoBranch,
                        sha: sha // 如果文件已存在，需要提供sha
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '保存失败');
            }

            return {
                success: true,
                message: '✓ 文章已成功保存到GitHub！'
            };

        } catch (error) {
            console.error('保存到GitHub失败：', error);
            return {
                success: false,
                message: `保存到GitHub失败：${error.message}（文章已保存在本地）`
            };
        }
    }

    // 获取原始JSON文件的URL（用于直接访问）
    getRawUrl() {
        return `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/${this.repoBranch}/${this.dataPath}`;
    }
}

// 全局GitHub管理器实例
const gitHubManager = new GitHubManager();

// 显示GitHub配置状态
function updateGitHubUI() {
    const syncBtn = document.getElementById('syncBtn');
    if (gitHubManager.isConfigured()) {
        syncBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 同步';
        syncBtn.style.display = 'block';
    } else {
        syncBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> (未配置)';
        syncBtn.style.display = 'block';
    }
}
