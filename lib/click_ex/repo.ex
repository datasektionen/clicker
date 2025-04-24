defmodule ClickEx.Repo do
  use Ecto.Repo,
    otp_app: :click_ex,
    adapter: Ecto.Adapters.Postgres
end
