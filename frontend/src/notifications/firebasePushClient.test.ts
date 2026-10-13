import { expect, it, vi } from 'vitest'
import { createPushClient, type PushSdk } from './firebasePushClient'
import type { PushDeviceRepository } from './pushDeviceRepository'
function setup(permission: NotificationPermission = 'granted') {
  let registered: (fid: string) => void = () => {}
  let message: () => void = () => {}
  const stopRegistered = vi.fn(), stopMessage = vi.fn()
  const sdk: PushSdk = { permission: () => permission, requestPermission: vi.fn(async () => permission),
    register: vi.fn(async () => { registered('fid') }), unregister: vi.fn(async () => {}),
    onRegistered: vi.fn(callback => { registered = callback; return stopRegistered }), onMessage: vi.fn(callback => { message = callback; return stopMessage }) }
  let version = 0
  const repository: PushDeviceRepository = { current: vi.fn(async () => ({ deviceId: null, enabled: false, bindingVersion: null })),
    register: vi.fn(async () => ({ deviceId: 'device', enabled: true, bindingVersion: String(++version) })), disable: vi.fn(async () => {}) }
  const client = createPushClient('1', sdk, repository)
  return { client, sdk, repository, registered: (fid: string) => registered(fid), message: () => message(), stopRegistered, stopMessage }
}
it('첫 방문은 권한을 묻지 않고 명시적 허용 후 받은 FID를 저장한다', async () => {
  const { client, sdk, repository } = setup()
  await client.start()
  expect(sdk.requestPermission).not.toHaveBeenCalled()
  expect(sdk.register).not.toHaveBeenCalled()
  await client.enable()
  expect(repository.register).toHaveBeenCalledWith('fid', '1', null, expect.any(AbortSignal))
  expect(client.getSnapshot().status).toBe('on')
  client.dispose()
})
it('권한 거부 시 FCM과 서버 등록을 하지 않는다', async () => {
  const { client, sdk, repository } = setup('denied')
  await client.start(); await client.enable()
  expect(client.getSnapshot().message).toContain('브라우저 설정')
  expect(sdk.register).not.toHaveBeenCalled(); expect(repository.register).not.toHaveBeenCalled()
  client.dispose()
})
it('반복 FID callback은 갱신된 버전을 사용하고 메시지는 즉시 재조회를 알린다', async () => {
  const { client, repository, registered, message } = setup()
  await client.start(); await client.enable()
  registered('fid-new')
  await vi.waitFor(() => expect(repository.register).toHaveBeenCalledTimes(2))
  expect(repository.register).toHaveBeenLastCalledWith('fid-new', '1', '1', expect.any(AbortSignal))
  const refresh = vi.fn(); const stop = client.subscribeRefresh(refresh)
  message(); expect(refresh).toHaveBeenCalledOnce()
  stop(); message(); expect(refresh).toHaveBeenCalledOnce()
  client.dispose()
})
it('서버 해제 후 SDK를 해제하고 늦은 callback은 재등록하지 않는다', async () => {
  const { client, sdk, repository, registered } = setup()
  await client.start(); await client.enable()
  await client.disable(); registered('late-fid')
  await Promise.resolve()
  expect(repository.disable).toHaveBeenCalledWith('1', '1', expect.any(AbortSignal))
  expect(vi.mocked(repository.disable).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(sdk.unregister).mock.invocationCallOrder[0] ?? 0)
  expect(repository.register).toHaveBeenCalledOnce()
  client.dispose()
})
it('로그아웃 후 SDK 실패는 재시도 안내로 남기고 서버 해제를 다시 요청하지 않는다', async () => {
  const { client, sdk, repository, registered } = setup()
  await client.start(); await client.enable()
  vi.mocked(sdk.unregister).mockRejectedValue(new Error('network'))
  await expect(client.afterLogout()).resolves.toBeUndefined()
  registered('late-fid'); await Promise.resolve()
  expect(repository.register).toHaveBeenCalledOnce()
  expect(repository.disable).not.toHaveBeenCalled()
  expect(client.getSnapshot().message).toContain('다시')
  client.dispose()
})
it('화면 정리는 SDK 구독만 제거하고 설치 등록은 지우지 않는다', async () => {
  const { client, sdk, stopRegistered, stopMessage } = setup()
  await client.start(); client.dispose()
  expect(stopRegistered).toHaveBeenCalledOnce(); expect(stopMessage).toHaveBeenCalledOnce()
  expect(sdk.unregister).not.toHaveBeenCalled()
})
it('등록 진행 중 해제하면 등록 응답의 새 버전을 해제하고 재등록하지 않는다', async () => {
  const { client, sdk, repository, registered } = setup()
  await client.start(); await client.enable()
  let finish!: (value: { deviceId: string; enabled: boolean; bindingVersion: string }) => void
  vi.mocked(repository.register).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  registered('rotated-fid')
  await Promise.resolve()
  const disabling = client.disable()
  finish({ deviceId: 'device', enabled: true, bindingVersion: '2' })
  await disabling
  expect(repository.disable).toHaveBeenCalledWith('1', '2', expect.any(AbortSignal))
  expect(sdk.unregister).toHaveBeenCalledOnce()
  client.dispose()
})
