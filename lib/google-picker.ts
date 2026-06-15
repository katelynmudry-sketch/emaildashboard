// lib/google-picker.ts
// Lazy-loads the Google Picker API (client-side) and opens a Google Docs file picker.

export interface PickedDoc {
  id: string
  name: string
}

interface PickerDoc {
  id: string
  name: string
}

interface PickerCallbackData {
  action: string
  docs?: PickerDoc[]
}

interface PickerView {
  setMimeTypes?(mimeTypes: string): PickerView
}

interface PickerBuilder {
  addView(view: PickerView | string): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setCallback(callback: (data: PickerCallbackData) => void): PickerBuilder
  build(): { setVisible(visible: boolean): void }
}

interface PickerNamespace {
  DocsView: new (viewId: string) => PickerView
  PickerBuilder: new () => PickerBuilder
  ViewId: { DOCUMENTS: string }
  Action: { PICKED: string; CANCEL: string }
}

interface GoogleNamespace {
  picker: PickerNamespace
}

interface GapiNamespace {
  load(api: string, options: { callback: () => void }): void
}

declare global {
  interface Window {
    gapi?: GapiNamespace
    google?: GoogleNamespace
  }
}

const PICKER_SCRIPT_SRC = "https://apis.google.com/js/api.js"

let pickerApiLoaded: Promise<void> | null = null

function loadPickerApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Picker is only available in the browser"))
  }

  if (window.google?.picker) {
    return Promise.resolve()
  }

  if (pickerApiLoaded) return pickerApiLoaded

  pickerApiLoaded = new Promise((resolve, reject) => {
    const onGapiReady = () => {
      window.gapi!.load("picker", { callback: () => resolve() })
    }

    if (window.gapi) {
      onGapiReady()
      return
    }

    const script = document.createElement("script")
    script.src = PICKER_SCRIPT_SRC
    script.async = true
    script.onload = onGapiReady
    script.onerror = () => reject(new Error("Failed to load Google Picker API"))
    document.body.appendChild(script)
  })

  return pickerApiLoaded
}

/** Opens a Google Picker scoped to Google Docs. Resolves to the picked doc, or null if cancelled. */
export async function openDocPicker(accessToken: string, apiKey: string): Promise<PickedDoc | null> {
  await loadPickerApi()
  const { picker } = window.google!

  return new Promise((resolve, reject) => {
    const builder = new picker.PickerBuilder()
      .addView(new picker.DocsView(picker.ViewId.DOCUMENTS))
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback(data => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0]
          resolve(doc ? { id: doc.id, name: doc.name } : null)
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null)
        }
      })

    try {
      builder.build().setVisible(true)
    } catch (err) {
      reject(err)
    }
  })
}
