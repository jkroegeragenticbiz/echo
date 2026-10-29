import Foundation

/// Subset of POST /api/saves' response (packages/core CreateSaveResponse).
struct CreateSaveResponse: Decodable {
  struct Save: Decodable {
    let id: String
    let status: String
  }
  struct Unlock: Decodable {
    let ad_unlock_id: String
    let ad_unit_id: String
  }
  let save: Save
  let duplicate: Bool
  let unlock: Unlock?
}

struct APIErrorBody: Decodable {
  let error: String?
  let code: String?
}

enum EchoAPIError: LocalizedError {
  case notSignedIn
  case notConfigured
  case server(status: Int, message: String, code: String?)

  var errorDescription: String? {
    switch self {
    case .notSignedIn: return "Open Echo and sign in first."
    case .notConfigured: return "Open Echo once to finish setting up."
    case let .server(_, message, _): return message
    }
  }
}

struct EchoAPI {
  let baseURL: URL
  let token: String

  static func fromSharedStore() throws -> EchoAPI {
    guard let token = SharedStore.authToken() else { throw EchoAPIError.notSignedIn }
    guard let url = SharedStore.apiURL else { throw EchoAPIError.notConfigured }
    return EchoAPI(baseURL: url, token: token)
  }

  private func request(_ path: String, method: String, contentType: String, body: Data) -> URLRequest {
    var req = URLRequest(url: baseURL.appendingPathComponent(path))
    req.httpMethod = method
    req.timeoutInterval = 25
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue(contentType, forHTTPHeaderField: "Content-Type")
    req.httpBody = body
    return req
  }

  private func send(_ req: URLRequest) async throws -> Data {
    let (data, response) = try await URLSession.shared.data(for: req)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200..<300).contains(status) else {
      let body = try? JSONDecoder().decode(APIErrorBody.self, from: data)
      throw EchoAPIError.server(status: status, message: body?.error ?? "Couldn't save this post.", code: body?.code)
    }
    return data
  }

  /// Uploads a downscaled screenshot to Vercel Blob via /api/uploads/direct.
  func uploadImage(_ jpeg: Data) async throws -> String {
    struct Uploaded: Decodable { let url: String }
    let data = try await send(request("api/uploads/direct", method: "POST", contentType: "image/jpeg", body: jpeg))
    return try JSONDecoder().decode(Uploaded.self, from: data).url
  }

  func createSave(_ payload: [String: Any]) async throws -> CreateSaveResponse {
    let body = try JSONSerialization.data(withJSONObject: payload)
    let data = try await send(request("api/saves", method: "POST", contentType: "application/json", body: body))
    return try JSONDecoder().decode(CreateSaveResponse.self, from: data)
  }
}
