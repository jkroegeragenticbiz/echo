import Foundation
import Security

/// The extension's side of the contract with the app
/// (apps/ios/modules/echo-shared/ios/EchoSharedModule.swift). Keep keys identical.
enum SharedStore {
  static let appGroup = "group.ai.getecho.shared"
  static let keychainService = "ai.getecho.auth"
  static let keychainAccount = "token"
  static let apiUrlKey = "echo.apiUrl"
  static let voiceNameKey = "echo.voiceName"
  static let planKey = "echo.plan"
  static let pendingKey = "echo.pending"
  static let pendingDirectory = "pending"

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static var apiURL: URL? {
    guard let raw = defaults?.string(forKey: apiUrlKey) else { return nil }
    return URL(string: raw)
  }

  static var voiceName: String { defaults?.string(forKey: voiceNameKey) ?? "your" }
  static var isPlus: Bool { defaults?.string(forKey: planKey) == "plus" }

  /// The bearer token the app stored in the shared keychain access group.
  static func authToken() -> String? {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrAccount as String: keychainAccount,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    if let prefix = Bundle.main.object(forInfoDictionaryKey: "AppIdentifierPrefix") as? String, !prefix.isEmpty {
      query[kSecAttrAccessGroup as String] = prefix + appGroup
    }
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  /// Queues work for the main app: an ad to watch, or a video to upload.
  static func addPending(_ item: [String: Any]) {
    guard let defaults else { return }
    var items: [[String: Any]] = []
    if let raw = defaults.string(forKey: pendingKey),
       let data = raw.data(using: .utf8),
       let existing = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
      items = existing
    }
    var entry = item
    entry["id"] = entry["id"] ?? UUID().uuidString
    entry["createdAt"] = ISO8601DateFormatter().string(from: Date())
    items.append(entry)
    if let out = try? JSONSerialization.data(withJSONObject: items), let json = String(data: out, encoding: .utf8) {
      defaults.set(json, forKey: pendingKey)
    }
  }

  /// Copies a shared video into the App Group so the app can upload it later.
  static func stashFile(at source: URL) throws -> String {
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      throw CocoaError(.fileNoSuchFile)
    }
    let dir = container.appendingPathComponent(pendingDirectory, isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let ext = source.pathExtension.isEmpty ? "mov" : source.pathExtension.lowercased()
    let name = "\(UUID().uuidString).\(ext)"
    try FileManager.default.copyItem(at: source, to: dir.appendingPathComponent(name))
    return name
  }
}
