Pod::Spec.new do |s|
  s.name           = 'EchoShared'
  s.version        = '1.0.0'
  s.summary        = 'App Group, shared keychain and Vision OCR bridge for Echo'
  s.author         = 'Echo'
  s.homepage       = 'https://getecho.ai'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'Security'
  s.source_files   = '**/*.swift'
end
