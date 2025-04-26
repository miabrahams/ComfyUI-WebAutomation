export class EvalBrowser {
  private modal?: HTMLElement

  async openModal() {
    // remove old
    if (this.modal) document.body.removeChild(this.modal)
    // container
    this.modal = document.createElement('div')
    Object.assign(this.modal.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: '1000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto'
    })
    // close
    const closeBtn = document.createElement('button')
    closeBtn.textContent = 'Close'
    closeBtn.onclick = () => {
      document.body.removeChild(this.modal!)
      this.modal = undefined
    }
    this.modal.appendChild(closeBtn)
    // content area
    const content = document.createElement('div')
    content.style.color = 'white'
    this.modal.appendChild(content)
    document.body.appendChild(this.modal)

    // fetch folders
    const res = await fetch('/rebase/data/folders')
    const data = await res.json()
    content.innerHTML = '<h2>Folders</h2>'
    const ul = document.createElement('ul')
    data.folders.forEach((f: string) => {
      const li = document.createElement('li')
      li.textContent = f
      li.style.cursor = 'pointer'
      li.onclick = () => this.loadImages(f)
      ul.appendChild(li)
    })
    content.appendChild(ul)
  }

  private async loadImages(folder: string) {
    if (!this.modal) return
    const res = await fetch(`/rebase/data/images?folder=${encodeURIComponent(folder)}`)
    const { images } = await res.json()
    const content = this.modal.querySelector('div:nth-child(2)') as HTMLElement
    content.innerHTML = `<h2>${folder} (${images.length})</h2>`
    const ul = document.createElement('ul')
    images.forEach((img: any) => {
      const li = document.createElement('li')
      li.textContent = img.filename
      ul.appendChild(li)
    })
    content.appendChild(ul)
  }
}
