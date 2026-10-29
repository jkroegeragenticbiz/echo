import ExpoModulesCore
import Foundation
import Security
import Vision

/// Shared contract with the Share Extension (targets/share/SharedStore.swift).
/// Keep the keys below identical in both files.
enum EchoSharedKeys {
  static let appGroup = "group.ai.getecho.shared"
  static let keychainService = "ai.getecho.auth"
  static let keychainAccount = "token"
  static let apiUrl = "echo.apiUrl"
  static let voiceName = "echo.voiceName"
  static let plan = "echo.plan"
  static let pending = "echo.pending"
  static let pendingDirectory = "pending"
}

public class EchoSharedModule: Module {
  private var defaults: UserDefaults? { UserDefaults(suiteName: EchoSharedKeys.appGroup) }

  /// "<TEAMID>.group.ai.getecho.shared", built from the AppIdentifierPrefix Info.plist entry.
  private var accessGroup: String? {
    guard let prefix = Bundle.main.object(forInfoDictionaryKey: "AppIdentifierPrefix") as? String, !prefix.isEmpty else {
      return nil
    }
    return prefix + EchoSharedKeys.appGroup
  }

  private func baseQuery() -> [String: Any] {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: EchoSharedKeys.keychainService,
      kSecAttrAccount as String: EchoSharedKeys.keychainAccount,
    ]
    if let group = accessGroup { query[kSecAttrAccessGroup as String] = group }
    return query
  }

  public func definition() -> ModuleDefinition {
    Name("EchoShared")

    AsyncFunction("setAuthToken") { (token: String?) in
      let query = self.baseQuery()
      SecItemDelete(query as CFDictionary)
      guard let token = token, let data = token.data(using: .utf8) else { return }
      var add = query
      add[kSecValueData as String] = data
      // Readable by the Share Extension after first unlock, never synced to iCloud.
      add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      let status = SecItemAdd(add as CFDictionary, nil)
      if status != errSecSuccess {
        throw Exception(name: "KeychainError", description: "Could not store the session (\(status))")
      }
    }

    AsyncFunction("getAuthToken") { () -> String? in
      var query = self.baseQuery()
      query[kSecReturnData as String] = true
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      var item: CFTypeRef?
      guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else {
        return nil
      }
      return String(data: data, encoding: .utf8)
    }

    Function("setContext") { (apiUrl: String, voiceName: String, plan: String) in
      self.defaults?.set(apiUrl, forKey: EchoSharedKeys.apiUrl)
      self.defaults?.set(voiceName, forKey: EchoSharedKeys.voiceName)
      self.defaults?.set(plan, forKey: EchoSharedKeys.plan)
    }

    /// JSON array of pending items written by the Share Extension.
    Function("readPending") { () -> String in
      self.defaults?.string(forKey: EchoSharedKeys.pending) ?? "[]"
    }

    Function("removePending") { (ids: [String]) in
      guard let raw = self.defaults?.string(forKey: EchoSharedKeys.pending),
            let data = raw.data(using: .utf8),
            let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return }
      let remaining = items.filter { !ids.contains(($0["id"] as? String) ?? "") }
      // Delete any video files that belonged to the removed items.
      for item in items where ids.contains((item["id"] as? String) ?? "") {
        if let name = item["fileName"] as? String, let url = self.pendingFileURL(name) {
          try? FileManager.default.removeItem(at: url)
        }
      }
      if let out = try? JSONSerialization.data(withJSONObject: remaining), let json = String(data: out, encoding: .utf8) {
        self.defaults?.set(json, forKey: EchoSharedKeys.pending)
      }
    }

    /// file:// URI for a video the extension copied into the App Group container.
    Function("pendingFileUri") { (fileName: String) -> String? in
      guard let url = self.pendingFileURL(fileName), FileManager.default.fileExists(atPath: url.path) else { return nil }
      return url.absoluteString
    }

    /// On-device OCR with Apple Vision, same settings as the Share Extension.
    AsyncFunction("recognizeText") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri) else {
        promise.reject("InvalidURI", "Not a file URL: \(uri)")
        return
      }
      DispatchQueue.global(qos: .userInitiated).async {
        // Read results after perform() so the promise settles exactly once.
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        do {
          try VNImageRequestHandler(url: url, options: [:]).perform([request])
          let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
          promise.resolve(lines.joined(separator: "\n"))
        } catch {
          promise.reject("OCRFailed", error.localizedDescription)
        }
      }
    }
  }

  private func pendingFileURL(_ name: String) -> URL? {
    FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: EchoSharedKeys.appGroup)?
      .appendingPathComponent(EchoSharedKeys.pendingDirectory, isDirectory: true)
      .appendingPathComponent(name)
  }
}
