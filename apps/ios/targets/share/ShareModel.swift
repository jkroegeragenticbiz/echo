import Foundation
import UIKit
import UniformTypeIdentifiers
import Vision

/// What the user shared, gathered from the extension's input items.
struct SharedContent {
  var url: URL?
  var text: String?
  var images: [UIImage] = []
  var videoFile: String?

  var isEmpty: Bool { url == nil && (text?.isEmpty ?? true) && images.isEmpty && videoFile == nil }

  var previewTitle: String {
    if videoFile != nil { return "Video" }
    if !images.isEmpty { return images.count == 1 ? "Screenshot" : "\(images.count) screenshots" }
    if let host = url?.host { return host.replacingOccurrences(of: "www.", with: "") }
    return "Text"
  }

  var previewDetail: String? {
    if let text, !text.isEmpty { return text }
    return url?.absoluteString
  }
}

@MainActor
final class ShareModel: ObservableObject {
  enum Phase: Equatable {
    case loading
    case ready
    case saving
    case savedPlus
    case needsAd(saveId: String, unlockId: String, adUnitId: String)
    case adQueued
    case duplicate
    case videoQueued
    case failed(String)
  }

  @Published var phase: Phase = .loading
  @Published var content = SharedContent()
  let voiceName = SharedStore.voiceName
  let isPlus = SharedStore.isPlus

  private let extensionContext: NSExtensionContext?

  init(extensionContext: NSExtensionContext?) {
    self.extensionContext = extensionContext
  }

  // MARK: - Reading the share

  func load() async {
    let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
    var shared = SharedContent()
    for provider in providers {
      do {
        if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
          shared.videoFile = try await stashVideo(provider)
        } else if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
          if let image = try await loadImage(provider) { shared.images.append(image) }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
          let item = try await provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil)
          if let url = item as? URL, !url.isFileURL { shared.url = url }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
          let item = try await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil)
          if let text = item as? String { shared.text = [shared.text, text].compactMap { $0 }.joined(separator: "\n") }
        }
      } catch {
        // Skip attachments we can't read; others may still work.
      }
    }
    // Some apps share a link as plain text.
    if shared.url == nil, let text = shared.text, let found = firstURL(in: text) {
      shared.url = found
    }
    content = shared
    phase = shared.isEmpty ? .failed("There's nothing here Echo can save.") : .ready
  }

  private func loadImage(_ provider: NSItemProvider) async throws -> UIImage? {
    let item = try await provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil)
    if let image = item as? UIImage { return image }
    if let url = item as? URL, let data = try? Data(contentsOf: url) { return UIImage(data: data) }
    if let data = item as? Data { return UIImage(data: data) }
    return nil
  }

  /// The provided file is deleted when the callback returns, so copy it inside.
  private func stashVideo(_ provider: NSItemProvider) async throws -> String {
    try await withCheckedThrowingContinuation { continuation in
      _ = provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, error in
        guard let url else {
          continuation.resume(throwing: error ?? CocoaError(.fileReadUnknown))
          return
        }
        do {
          continuation.resume(returning: try SharedStore.stashFile(at: url))
        } catch {
          continuation.resume(throwing: error)
        }
      }
    }
  }

  private func firstURL(in text: String) -> URL? {
    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
    let range = NSRange(text.startIndex..., in: text)
    return detector?.firstMatch(in: text, options: [], range: range)?.url
  }

  // MARK: - Saving

  func save() async {
    phase = .saving
    do {
      // Videos are uploaded by the app (too large for an extension request).
      if let file = content.videoFile {
        guard SharedStore.authToken() != nil else { throw EchoAPIError.notSignedIn }
        SharedStore.addPending([
          "kind": "video",
          "fileName": file,
          "sourceUrl": content.url?.absoluteString ?? "",
          "text": content.text ?? "",
        ])
        phase = .videoQueued
        return
      }

      let api = try EchoAPI.fromSharedStore()
      var payload: [String: Any] = [:]
      if let url = content.url { payload["url"] = url.absoluteString }
      if let text = content.text, !text.isEmpty { payload["text"] = text }

      if !content.images.isEmpty {
        var media: [[String: Any]] = []
        var recognized: [String] = []
        for image in content.images {
          if let text = await recognizeText(in: image), !text.isEmpty { recognized.append(text) }
          if let jpeg = downscaledJPEG(image) {
            let uploadedURL = try await api.uploadImage(jpeg)
            media.append(["url": uploadedURL, "kind": "image", "content_type": "image/jpeg"])
          }
        }
        payload["media"] = media
        if !recognized.isEmpty { payload["ocr_text"] = recognized.joined(separator: "\n\n") }
      }

      let response = try await api.createSave(payload)
      if response.duplicate {
        phase = .duplicate
      } else if let unlock = response.unlock {
        phase = .needsAd(saveId: response.save.id, unlockId: unlock.ad_unlock_id, adUnitId: unlock.ad_unit_id)
      } else {
        phase = .savedPlus
        try? await Task.sleep(nanoseconds: 1_200_000_000)
        close()
      }
    } catch {
      phase = .failed(error.localizedDescription)
    }
  }

  /// Free plan: the rewarded ad plays in the main app the next time it opens.
  func queueAd() {
    if case let .needsAd(saveId, unlockId, adUnitId) = phase {
      SharedStore.addPending([
        "kind": "unlock",
        "saveId": saveId,
        "adUnlockId": unlockId,
        "adUnitId": adUnitId,
        "voiceName": voiceName,
      ])
      phase = .adQueued
    }
  }

  func close() {
    extensionContext?.completeRequest(returningItems: nil)
  }

  // MARK: - Image helpers

  private func recognizeText(in image: UIImage) async -> String? {
    guard let cgImage = image.cgImage else { return nil }
    return await withCheckedContinuation { continuation in
      DispatchQueue.global(qos: .userInitiated).async {
        // Read results after perform() so the continuation resumes exactly once.
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        do {
          try VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:]).perform([request])
          let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
          continuation.resume(returning: lines.joined(separator: "\n"))
        } catch {
          continuation.resume(returning: nil)
        }
      }
    }
  }

  /// Keeps uploads well under the API's 4 MB limit.
  private func downscaledJPEG(_ image: UIImage, maxDimension: CGFloat = 1600) -> Data? {
    let longest = max(image.size.width, image.size.height)
    let scale = min(1, maxDimension / max(longest, 1))
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    return resized.jpegData(compressionQuality: 0.8)
  }
}
