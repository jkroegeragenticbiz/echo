import SwiftUI

/// Echo palette (see apps/ios/lib/theme.ts).
private enum Palette {
  static let canvas = Color(red: 247 / 255, green: 246 / 255, blue: 242 / 255)
  static let line = Color(red: 234 / 255, green: 232 / 255, blue: 225 / 255)
  static let ink = Color(red: 17 / 255, green: 19 / 255, blue: 21 / 255)
  static let body = Color(red: 85 / 255, green: 85 / 255, blue: 79 / 255)
  static let muted = Color(red: 138 / 255, green: 138 / 255, blue: 131 / 255)
  static let accent = Color(red: 13 / 255, green: 148 / 255, blue: 136 / 255)
}

struct ShareView: View {
  @ObservedObject var model: ShareModel

  var body: some View {
    ZStack(alignment: .bottom) {
      Color.black.opacity(0.18)
        .ignoresSafeArea()
        .onTapGesture { model.close() }

      VStack(alignment: .leading, spacing: 18) {
        header
        preview
        actions
      }
      .padding(22)
      .background(
        RoundedRectangle(cornerRadius: 24, style: .continuous)
          .fill(Color.white)
          .shadow(color: Palette.ink.opacity(0.08), radius: 24, y: 8)
      )
      .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Palette.line, lineWidth: 1))
      .padding(.horizontal, 12)
      .padding(.bottom, 12)
    }
    .task { await model.load() }
  }

  private var header: some View {
    HStack(alignment: .top) {
      VStack(alignment: .leading, spacing: 6) {
        Text("Save to Echo")
          .font(.system(size: 20, weight: .semibold))
          .foregroundStyle(Palette.ink)
        HStack(spacing: 6) {
          Capsule().fill(Palette.accent).frame(width: 3, height: 12)
          Text("Rewrite as \(model.voiceName)")
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Palette.accent)
        }
      }
      Spacer()
      Button(action: model.close) {
        Image(systemName: "xmark")
          .font(.system(size: 14, weight: .medium))
          .foregroundStyle(Palette.muted)
          .frame(width: 30, height: 30)
          .background(Circle().fill(Palette.canvas))
      }
      .accessibilityLabel("Close")
    }
  }

  @ViewBuilder private var preview: some View {
    switch model.phase {
    case .loading:
      ProgressView().frame(maxWidth: .infinity, minHeight: 64)
    default:
      HStack(spacing: 12) {
        if let image = model.content.images.first {
          Image(uiImage: image).resizable().scaledToFill()
            .frame(width: 52, height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        VStack(alignment: .leading, spacing: 3) {
          Text(model.content.previewTitle)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Palette.ink)
          if let detail = model.content.previewDetail {
            Text(detail).font(.system(size: 13)).foregroundStyle(Palette.body).lineLimit(2)
          }
        }
        Spacer(minLength: 0)
      }
      .padding(14)
      .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.canvas))
    }
  }

  @ViewBuilder private var actions: some View {
    switch model.phase {
    case .loading:
      EmptyView()
    case .ready:
      PrimaryButton(title: "Save") { Task { await model.save() } }
      if !model.isPlus {
        Text("Free plan: watch a short ad to unlock the rewrite.")
          .font(.system(size: 12)).foregroundStyle(Palette.muted)
      }
    case .saving:
      PrimaryButton(title: "Saving…", busy: true) {}
    case .savedPlus:
      Status(icon: "checkmark.circle", text: "Saved. Rewriting in your \(model.voiceName) voice.")
    case .needsAd:
      Status(icon: "checkmark.circle", text: "Saved to your library.")
      PrimaryButton(title: "Watch a short ad to save free") { model.queueAd() }
      SecondaryButton(title: "Not now") { model.close() }
    case .adQueued:
      Status(icon: "play.circle", text: "Open Echo to watch it. Your rewrite will be waiting.")
      SecondaryButton(title: "Done") { model.close() }
    case .duplicate:
      Status(icon: "tray.full", text: "Already in your library.")
      SecondaryButton(title: "Done") { model.close() }
    case .videoQueued:
      Status(icon: "film", text: "Saved. Open Echo to finish uploading your video.")
      SecondaryButton(title: "Done") { model.close() }
    case let .failed(message):
      Status(icon: "exclamationmark.circle", text: message)
      SecondaryButton(title: "Close") { model.close() }
    }
  }
}

private struct PrimaryButton: View {
  let title: String
  var busy = false
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 8) {
        if busy { ProgressView().tint(.white) }
        Text(title).font(.system(size: 16, weight: .semibold))
      }
      .frame(maxWidth: .infinity, minHeight: 50)
      .foregroundStyle(.white)
      .background(Capsule().fill(Palette.ink))
    }
    .disabled(busy)
  }
}

private struct SecondaryButton: View {
  let title: String
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Text(title)
        .font(.system(size: 16, weight: .semibold))
        .frame(maxWidth: .infinity, minHeight: 48)
        .foregroundStyle(Palette.ink)
        .background(Capsule().stroke(Palette.line, lineWidth: 1))
    }
  }
}

private struct Status: View {
  let icon: String
  let text: String

  var body: some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: icon).font(.system(size: 17, weight: .regular)).foregroundStyle(Palette.ink)
      Text(text).font(.system(size: 15)).foregroundStyle(Palette.body).fixedSize(horizontal: false, vertical: true)
    }
  }
}
