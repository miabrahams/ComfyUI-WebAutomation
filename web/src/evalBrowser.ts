const app = window.comfyAPI.app.app

interface ImageItem {
  filename: string
  url: string
  has_workflow?: boolean
}

export class EvalBrowser {
  private modal?: HTMLElement
  private escListener?: (e: KeyboardEvent) => void
  private currentFolder?: string
  private currentType: string = 'evals'

  async openModal() {
    // Remove existing modal if it exists
    this.closeModal()

    // Create modal container
    this.modal = document.createElement('div')
    Object.assign(this.modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: '1000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      overflow: 'auto'
    })

    // Header
    const header = document.createElement('div')
    header.style.marginBottom = '20px'
    header.style.display = 'flex'
    header.style.width = '80%'
    header.style.justifyContent = 'space-between'
    header.style.alignItems = 'center'

    // Title
    const title = document.createElement('h2')
    title.textContent = 'Image Browser'
    title.style.color = 'white'

    // Close button
    const closeBtn = document.createElement('button')
    closeBtn.textContent = 'Close'
    closeBtn.onclick = () => this.closeModal()

    header.appendChild(title)
    header.appendChild(closeBtn)
    this.modal.appendChild(header)

    // Content container
    const content = document.createElement('div')
    content.style.width = '80%'
    content.style.backgroundColor = 'rgba(30,30,30,0.8)'
    content.style.borderRadius = '8px'
    content.style.padding = '20px'
    content.style.color = 'white'
    content.style.maxHeight = '80%'
    content.style.overflow = 'auto'
    this.modal.appendChild(content)

    document.body.appendChild(this.modal)

    // Setup ESC key to close
    this.escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeModal()
    }
    window.addEventListener('keydown', this.escListener)

    // Fetch and display folders
    await this.loadFolders(content)
  }

  private closeModal() {
    if (this.modal) {
      document.body.removeChild(this.modal)
      this.modal = undefined
    }
    if (this.escListener) {
      window.removeEventListener('keydown', this.escListener)
      this.escListener = undefined
    }
  }

  private async loadFolders(container: HTMLElement) {
    try {
      container.innerHTML = '<h3>Loading folders...</h3>'
      const res = await fetch(`/rebase/data/folders?type=${this.currentType}`)

      if (!res.ok) {
        container.innerHTML = '<h3>Error loading folders</h3>'
        return
      }

      const data = await res.json()

      if (!data.folders || data.folders.length === 0) {
        container.innerHTML = `
          <h3>No folders found</h3>
          <p>Create subfolders in the data/${this.currentType} directory to get started.</p>
        `
        return
      }

      // Display folders
      container.innerHTML = '<h3>Select a folder:</h3>'
      const list = document.createElement('ul')
      list.style.listStyleType = 'none'
      list.style.padding = '0'

      data.folders.forEach((folder: string) => {
        const li = document.createElement('li')
        li.style.padding = '10px 5px'
        li.style.margin = '5px 0'
        li.style.backgroundColor = 'rgba(60,60,60,0.5)'
        li.style.borderRadius = '4px'
        li.style.cursor = 'pointer'
        li.textContent = folder

        li.onclick = () => {
          this.currentFolder = folder
          this.loadImages(container)
        }

        list.appendChild(li)
      })

      container.appendChild(list)

    } catch (error) {
      container.innerHTML = `<h3>Error: ${(error as Error).message}</h3>`
      console.error('Failed to load folders:', error)
    }
  }

  private async loadImages(container: HTMLElement) {
    if (!this.currentFolder) return

    try {
      container.innerHTML = `<h3>Loading images from "${this.currentFolder}"...</h3>`

      const url = `/rebase/data/images?type=${this.currentType}&folder=${encodeURIComponent(this.currentFolder)}`
      const res = await fetch(url)

      if (!res.ok) {
        container.innerHTML = `<h3>Error loading images from "${this.currentFolder}"</h3>`
        return
      }

      const data = await res.json()

      // Add back button
      const backButton = document.createElement('button')
      backButton.textContent = '← Back to folders'
      backButton.style.marginBottom = '15px'
      backButton.onclick = () => this.loadFolders(container)

      container.innerHTML = ''
      container.appendChild(backButton)

      const header = document.createElement('h3')
      header.textContent = `${this.currentFolder} (${data.images.length} images)`
      container.appendChild(header)

      if (data.images.length === 0) {
        const msg = document.createElement('p')
        msg.textContent = 'No images found in this folder.'
        container.appendChild(msg)
        return
      }

      // Create grid for images
      const grid = document.createElement('div')
      grid.style.display = 'grid'
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))'
      grid.style.gap = '10px'

      data.images.forEach((img: ImageItem) => {
        const item = document.createElement('div')
        item.style.cursor = 'pointer'
        item.style.position = 'relative'
        item.style.borderRadius = '4px'
        item.style.overflow = 'hidden'

        // Create thumbnail
        const thumbnail = document.createElement('img')
        thumbnail.src = img.url
        thumbnail.alt = img.filename
        thumbnail.style.width = '100%'
        thumbnail.style.height = '150px'
        thumbnail.style.objectFit = 'cover'

        // Add workflow badge if available
        if (img.has_workflow) {
          const badge = document.createElement('span')
          badge.textContent = '⚙️'
          badge.title = 'Has embedded workflow'
          badge.style.position = 'absolute'
          badge.style.top = '5px'
          badge.style.right = '5px'
          badge.style.backgroundColor = 'rgba(0,0,0,0.6)'
          badge.style.borderRadius = '50%'
          badge.style.padding = '3px'
          item.appendChild(badge)
        }

        // Add filename
        const caption = document.createElement('div')
        caption.textContent = img.filename
        caption.style.padding = '5px'
        caption.style.textOverflow = 'ellipsis'
        caption.style.overflow = 'hidden'
        caption.style.whiteSpace = 'nowrap'
        caption.style.fontSize = '12px'
        caption.style.backgroundColor = 'rgba(0,0,0,0.6)'

        // Handle click
        item.onclick = () => this.loadWorkflow(img)

        item.appendChild(thumbnail)
        item.appendChild(caption)
        grid.appendChild(item)
      })

      container.appendChild(grid)

    } catch (error) {
      container.innerHTML = `<h3>Error: ${(error as Error).message}</h3>`
      console.error('Failed to load images:', error)
    }
  }

  private async loadWorkflow(img: ImageItem) {
    try {
      const infoUrl = img.url
      const res = await fetch(infoUrl)

      if (!res.ok) {
        console.warn('No workflow data found for', img.filename)
        return
      }

      const blob = await res.blob()
      const file = new File([blob], img.filename, {
            type: res.headers.get('Content-Type') || '',
      });
      console.log("file size:", file.size, "file name:", file.name)

      // Load workflow into ComfyUI
      await app.handleFile(file)
      console.log('Workflow loaded from', img.filename)

      // Close modal
      this.closeModal()

    } catch (error) {
      console.error('Error loading workflow:', error)
      alert(`Error loading workflow: ${(error as Error).message}`)
    }
  }
}
