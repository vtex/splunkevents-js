# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.0] - 2021-04-07
### Added
- Configuration `useExponentialBackoff`, `maxNumberOfRetries`,
  `exponentialBackoffLimit` to add an exponential backoff strategy
  to request retry.

## [1.5.0] - 2021-03-26
### Added
- UMD and ESM build types.

## [1.4.2] - 2021-03-09
### Added
- Custom header to be added in the request

## [1.4.1] - 2020-09-18
### Fixed
- Infinite loop in flush without custom request function.

## [1.4.0] - 2020-09-17 [YANKED]
### Changed
- Migrate to TypeScript :tada:

## [1.3.4] - 2020-05-18
### Fixed
- Typo on additional info.

## [1.3.3] - 2020-05-18 [YANKED]
### Fixed
- Adding additional info.

## [1.3.2] - 2020-04-08
### Added
- New `shouldParseEventData` config

### Changed
- Update documentation
