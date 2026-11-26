Pod::Spec.new do |s|
  s.name           = 'EchoPdf'
  s.version        = '1.0.0'
  s.summary        = 'Renders PDF pages to JPEG for EchoReader imports'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'TalonSight Technologies'
  s.homepage       = 'https://github.com/JSama99/EchoReader'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/JSama99/EchoReader.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'PDFKit'
  s.source_files   = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
